import { NextRequest, NextResponse } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { upsertEmbeddingsForNote } from '@/lib/notes/embeddings';
import { Note } from '@/lib/notes/types';

export const runtime = 'nodejs';

const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'nomic-embed-text';

function getBasePath(req: NextRequest, bodyBasePath?: string | null): string | null {
  return (
    bodyBasePath ||
    req.nextUrl.searchParams.get('basePath') ||
    req.headers.get('x-notes-path') ||
    process.env.LOCAL_NOTES_PATH ||
    null
  );
}

// Check if embedding model is available
async function checkEmbeddingModel(host: string, model: string): Promise<{ available: boolean; error?: string }> {
  try {
    const response = await fetch(`${host}/api/tags`);
    if (!response.ok) {
      return { available: false, error: 'Ollama nicht erreichbar' };
    }
    const data = await response.json();
    const models = data.models || [];
    const found = models.some((m: { name: string }) => 
      m.name === model || m.name.startsWith(`${model}:`)
    );
    
    if (!found) {
      return { 
        available: false, 
        error: `Embedding-Modell "${model}" nicht installiert. Bitte zuerst mit "ollama pull ${model}" installieren.` 
      };
    }
    return { available: true };
  } catch (err) {
    return { 
      available: false, 
      error: `Ollama nicht erreichbar: ${err instanceof Error ? err.message : 'Verbindungsfehler'}` 
    };
  }
}

// Streaming response for progress
export async function POST(req: NextRequest) {
  const body = await req.json();
  const basePath = getBasePath(req, body.basePath || null);
  const noteId: string | undefined = body.noteId;
  const model: string = body.model || DEFAULT_MODEL;
  const host: string = (body.host || DEFAULT_HOST).replace(/\/$/, '');
  const chunkSize: number | undefined = body.chunkSize;
  const chunkOverlap: number | undefined = body.chunkOverlap;
  const streaming: boolean = body.streaming ?? true;

  if (!basePath) {
    return NextResponse.json({ error: 'basePath is required' }, { status: 400 });
  }

  // Check if model is available first
  const modelCheck = await checkEmbeddingModel(host, model);
  if (!modelCheck.available) {
    return NextResponse.json({ error: modelCheck.error }, { status: 400 });
  }

  const storage = new FileNoteStorage(basePath);
  let targets: Note[] = [];

  if (noteId) {
    const note = await storage.getNote(noteId);
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    targets = [note];
  } else {
    const summaries = await storage.listNotes();
    const fetched = await Promise.all(summaries.map((s) => storage.getNote(s.id)));
    targets = fetched.filter(Boolean) as Note[];
  }

  if (targets.length === 0) {
    return NextResponse.json({ error: 'Keine Notizen zum Verarbeiten gefunden' }, { status: 400 });
  }

  // Streaming response
  if (streaming) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const total = targets.length;
        let processed = 0;
        const errors: string[] = [];

        // Send initial status
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'start', 
          total, 
          model 
        })}\n\n`));

        for (const note of targets) {
          try {
            // Send progress
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'progress', 
              current: processed + 1, 
              total, 
              noteTitle: note.title 
            })}\n\n`));

            await upsertEmbeddingsForNote(basePath, note, { model, host, chunkSize, chunkOverlap });
            processed++;

            // Send success for this note
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'note_done', 
              noteId: note.id, 
              noteTitle: note.title 
            })}\n\n`));

          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
            errors.push(`${note.title}: ${errorMsg}`);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'note_error', 
              noteId: note.id, 
              noteTitle: note.title, 
              error: errorMsg 
            })}\n\n`));
          }
        }

        // Send completion
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'done', 
          processed, 
          total, 
          errors: errors.length > 0 ? errors : undefined 
        })}\n\n`));

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // Non-streaming fallback
  const updated: string[] = [];
  const errors: string[] = [];

  for (const note of targets) {
    try {
      await upsertEmbeddingsForNote(basePath, note, { model, host, chunkSize, chunkOverlap });
      updated.push(note.id);
    } catch (err) {
      errors.push(`${note.title}: ${err instanceof Error ? err.message : 'Fehler'}`);
    }
  }

  return NextResponse.json({
    updated,
    model,
    count: updated.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}


