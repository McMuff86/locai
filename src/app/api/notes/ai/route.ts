import { NextRequest } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { Note } from '@/lib/notes/types';
import { performWebSearch } from '@/lib/webSearch';
import { sanitizeBasePath, validateSearxngUrl } from '../../_utils/security';
import { resolveAndValidateOllamaHost } from '../../_utils/ollama';
import { apiError } from '../../_utils/responses';
import { createServerProvider } from '@/lib/providers/server';
import type { ProviderType } from '@/lib/providers/types';

export const runtime = 'nodejs';

type AiAction = 'complete' | 'summarize';

interface AiBody {
  basePath?: string;
  noteId?: string;
  content?: string;
  action?: AiAction;
  model?: string;
  provider?: ProviderType;
  host?: string;
  prompt?: string;
  numCtx?: number;
  useWebSearch?: boolean;
  searchQuery?: string;
  searxngUrl?: string;
  externalContext?: string;
}

const DEFAULT_MODEL = 'llama3';
const MAX_WEB_CONTEXT = 4000;
const MAX_WEB_SNIPPET = 600;
const MAX_WEB_RESULTS = 3;
const SYSTEM_PROMPT = 'You assist with editing and summarizing notes. Respond in the same language as the note.';

function resolveBasePath(req: NextRequest, body: AiBody): string | null {
  return (
    body.basePath ||
    req.nextUrl.searchParams.get('basePath') ||
    req.headers.get('x-notes-path') ||
    process.env.LOCAL_NOTES_PATH ||
    null
  );
}

async function loadContent(basePath: string, noteId?: string, rawContent?: string): Promise<Note> {
  const storage = new FileNoteStorage(basePath);
  if (noteId) {
    const note = await storage.getNote(noteId);
    if (!note) throw new Error('Note not found');
    return note;
  }
  return {
    id: 'temp',
    title: 'Untitled',
    content: rawContent || '',
    tags: [],
    links: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildPrompt(action: AiAction, note: Note, userPrompt?: string) {
  const basePrompt =
    action === 'summarize'
      ? `Fasse die folgende Notiz prägnant zusammen und schlage 2-4 Tags vor.`
      : `Setze die folgende Notiz sinnvoll fort oder ergänze sie mit einem nächsten Abschnitt. Bleibe im Stil der Notiz.`;

  const customInstruction = userPrompt?.trim()
    ? `\n\nZusätzliche Anweisung des Nutzers:\n${userPrompt.trim()}`
    : '';

  return [
    basePrompt,
    customInstruction,
    `\n\nTitel: ${note.title}`,
    `\n\nInhalt:\n${note.content}`,
  ].join('');
}

function buildUserContent(prompt: string, externalContext?: string, webContext?: string): string {
  const parts: string[] = [];
  if (externalContext) {
    parts.push('Nutze den folgenden externen Web-Kontext (vom Nutzer ausgewählt):');
    parts.push(externalContext);
    parts.push('---');
  }
  if (webContext) {
    parts.push('Nutze folgende Web-Suche als Kontext:');
    parts.push(webContext);
    parts.push('---');
  }
  parts.push(prompt);
  return parts.join('\n\n');
}

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
}

/**
 * Stream response from an external provider (Anthropic, OpenAI, OpenRouter)
 * using the ChatProvider abstraction.
 */
function streamFromProvider(
  provider: NonNullable<ReturnType<typeof createServerProvider>>,
  model: string,
  userContent: string,
): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const generator = provider.chatStream(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          { model },
        );
        for await (const chunk of generator) {
          if (chunk.content) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: chunk.content })}\n\n`));
          }
          if (chunk.done) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Provider streaming error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Stream response from Ollama directly (true token-by-token streaming).
 */
function streamFromOllama(
  host: string,
  model: string,
  userContent: string,
  numCtx?: number,
): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(`${host}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            stream: true,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            options: numCtx ? { num_ctx: numCtx } : undefined,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Model error: ${text}` })}\n\n`));
          controller.close();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter((line) => line.trim());

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                const content = json?.message?.content || '';
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: content })}\n\n`));
                }
                if (json.done) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ollama streaming error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AiBody;
    const rawBasePath = resolveBasePath(req, body);
    if (!rawBasePath) return apiError('basePath is required', 400);
    const basePath = sanitizeBasePath(rawBasePath);
    if (!basePath) return apiError('Invalid basePath', 400);

    const action: AiAction = body.action || 'complete';
    const note = await loadContent(basePath, body.noteId, body.content);
    const model = body.model || DEFAULT_MODEL;
    const providerType: ProviderType = body.provider || 'ollama';

    // Resolve Ollama host (needed for web search even with external providers)
    let host: string;
    try {
      host = resolveAndValidateOllamaHost(body.host);
    } catch (err) {
      if (providerType === 'ollama') {
        return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
      }
      // Non-Ollama providers don't need a valid Ollama host
      host = '';
    }

    if (body.searxngUrl) {
      const searxCheck = validateSearxngUrl(body.searxngUrl);
      if (!searxCheck.valid) {
        return apiError(searxCheck.reason, 400);
      }
    }

    // Optional: Web search enrichment
    let webContext = '';
    if (body.useWebSearch && host) {
      try {
        const webResult = await performWebSearch(body.searchQuery || note.title, {
          searxngUrl: body.searxngUrl,
          ollamaHost: host,
          model,
          maxResults: 5,
          fetchContent: true,
          selectBestResult: true,
          optimizeQuery: true,
        });
        if (webResult?.success) {
          if (webResult.content?.content) {
            const trimmed = webResult.content.content.slice(0, MAX_WEB_CONTEXT);
            const source = webResult.selection?.title || 'Quelle';
            const url = webResult.selection?.url || '';
            webContext = [
              `🔍 Web-Suche: ${webResult.originalQuestion}`,
              `📄 Quelle: ${source}`,
              url ? `🔗 ${url}` : '',
              '',
              trimmed,
            ]
              .filter(Boolean)
              .join('\n');
          } else if (webResult.search?.results?.length) {
            const snippets = webResult.search.results
              .slice(0, MAX_WEB_RESULTS)
              .map((r, idx) => {
                const snip = (r.content || '').slice(0, MAX_WEB_SNIPPET);
                return [`[${idx + 1}] ${r.title}`, r.url, snip].filter(Boolean).join('\n');
              })
              .join('\n\n');
            webContext = [
              `🔍 Web-Suche: ${webResult.originalQuestion}`,
              '',
              'Top Snippets:',
              snippets,
            ].join('\n');
          }
        }
      } catch (err) {
        console.error('notes/ai websearch error', err);
      }
    }

    const prompt = buildPrompt(action, note, body.prompt);
    const userContent = buildUserContent(prompt, body.externalContext, webContext);

    // Route to the appropriate streaming implementation
    let stream: ReadableStream;

    if (providerType !== 'ollama') {
      const provider = createServerProvider(providerType);
      if (!provider) {
        return apiError(`Provider "${providerType}" is not configured. Check your API key in settings or .env.local.`, 400);
      }
      stream = streamFromProvider(provider, model, userContent);
    } else {
      stream = streamFromOllama(host, model, userContent, body.numCtx);
    }

    return new Response(stream, { headers: sseHeaders() });
  } catch (error) {
    console.error('notes/ai error', error);
    return apiError('AI request failed', 500);
  }
}
