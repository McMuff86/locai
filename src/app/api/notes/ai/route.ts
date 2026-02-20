import { NextRequest } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { Note } from '@/lib/notes/types';
import { performWebSearch } from '@/lib/webSearch';
import { sanitizeBasePath, validateSearxngUrl } from '../../_utils/security';
import { resolveAndValidateOllamaHost } from '../../_utils/ollama';
import { apiError } from '../../_utils/responses';

export const runtime = 'nodejs';

type AiAction = 'complete' | 'summarize';

interface AiBody {
  basePath?: string;
  noteId?: string;
  content?: string;
  action?: AiAction;
  model?: string;
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AiBody;
    const rawBasePath = resolveBasePath(req, body);
    if (!rawBasePath) return apiError('basePath is required', 400);
    // SEC-2: Validate basePath (no traversal)
    const basePath = sanitizeBasePath(rawBasePath);
    if (!basePath) return apiError('Invalid basePath', 400);

    const action: AiAction = body.action || 'complete';
    const note = await loadContent(basePath, body.noteId, body.content);

    const model = body.model || DEFAULT_MODEL;
    let host: string;
    try {
      host = resolveAndValidateOllamaHost(body.host);
    } catch (err) {
      return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
    }

    if (body.searxngUrl) {
      const searxCheck = validateSearxngUrl(body.searxngUrl);
      if (!searxCheck.valid) {
        return apiError(searxCheck.reason, 400);
      }
    }

    // Optional: Web search enrichment
    let webContext = '';
    if (body.useWebSearch) {
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
          // Trim to avoid oversize prompts
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
    const userContent = (() => {
      const parts: string[] = [];
      if (body.externalContext) {
        parts.push('Nutze den folgenden externen Web-Kontext (vom Nutzer ausgewählt):');
        parts.push(body.externalContext);
        parts.push('---');
      }
      if (webContext) {
        parts.push('Nutze folgende Web-Suche als Kontext:');
        parts.push(webContext);
        parts.push('---');
      }
      parts.push(prompt);
      return parts.join('\n\n');
    })();

    // Streaming response from Ollama
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: 'You assist with editing and summarizing notes. Respond in the same language as the note.' },
          { role: 'user', content: userContent },
        ],
        options: body.numCtx ? { num_ctx: body.numCtx } : undefined,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return apiError(`Model error: ${text}`, 500);
    }

    // Stream the response to the client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
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
                  // Send each token as a SSE event
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
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('notes/ai error', error);
    return apiError('AI request failed', 500);
  }
}


