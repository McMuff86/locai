import { NextRequest, NextResponse } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { Note } from '@/lib/notes/types';
import { performWebSearch, formatForChat } from '@/lib/webSearch';

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
}

const DEFAULT_MODEL = 'llama3';
const DEFAULT_HOST = 'http://localhost:11434';

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
    const basePath = resolveBasePath(req, body);
    if (!basePath) return NextResponse.json({ error: 'basePath is required' }, { status: 400 });

    const action: AiAction = body.action || 'complete';
    const note = await loadContent(basePath, body.noteId, body.content);

    const model = body.model || DEFAULT_MODEL;
    const host = (body.host || DEFAULT_HOST).replace(/\/$/, '');
    // Optional: Web search enrichment
    let webContext = '';
    if (body.useWebSearch) {
      try {
        const webResult = await performWebSearch(body.searchQuery || note.title, {
          searxngUrl: body.searxngUrl,
          ollamaHost: body.host || DEFAULT_HOST,
          model: body.model || DEFAULT_MODEL,
          maxResults: 5,
          fetchContent: true,
          selectBestResult: true,
          optimizeQuery: true,
        });
        if (webResult?.success) {
          webContext = formatForChat(webResult);
        }
      } catch (err) {
        console.error('notes/ai websearch error', err);
      }
    }

    const prompt = buildPrompt(action, note, body.prompt);
    const userContent = webContext
      ? `Nutze folgende Web-Suche als Kontext:\n${webContext}\n\n---\n\n${prompt}`
      : prompt;

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
      return NextResponse.json({ error: `Model error: ${text}` }, { status: 500 });
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
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}


