import { NextRequest, NextResponse } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { upsertEmbeddingsForNote, loadEmbeddings } from '@/lib/notes/embeddings';
import { Note } from '@/lib/notes/types';
import { sanitizeBasePath } from '../../_utils/security';
import { resolveAndValidateOllamaHost } from '../../_utils/ollama';
import { apiError } from '../../_utils/responses';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

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

// Compute a content hash for change detection
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
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
  let host: string;
  try {
    host = resolveAndValidateOllamaHost(body.host);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
  }
  const chunkSize: number | undefined = body.chunkSize;
  const chunkOverlap: number | undefined = body.chunkOverlap;
  const streaming: boolean = body.streaming ?? true;
  const forceRebuild: boolean = body.forceRebuild ?? false;

  if (!basePath) {
    return apiError('basePath is required', 400);
  }

  // SEC-2: Validate basePath (no traversal)
  const safeBasePath = sanitizeBasePath(basePath);
  if (!safeBasePath) {
    return apiError('Invalid basePath', 400);
  }

  // Check if model is available first
  const modelCheck = await checkEmbeddingModel(host, model);
  if (!modelCheck.available) {
    return apiError(modelCheck.error || 'Embedding model not available', 400);
  }

  const storage = new FileNoteStorage(safeBasePath);
  let allNotes: Note[] = [];

  if (noteId) {
    const note = await storage.getNote(noteId);
    if (!note) return apiError('Note not found', 404);
    allNotes = [note];
  } else {
    const summaries = await storage.listNotes();
    const fetched = await Promise.all(summaries.map((s) => storage.getNote(s.id)));
    allNotes = fetched.filter(Boolean) as Note[];
  }

  if (allNotes.length === 0) {
    return apiError('Keine Notizen zum Verarbeiten gefunden', 400);
  }

  // Incremental: determine which notes actually need re-embedding
  let targets: Note[] = allNotes;
  let skippedCount = 0;

  if (!forceRebuild && !noteId) {
    try {
      const existingEmbeddings = await loadEmbeddings(safeBasePath);
      
      // Build a map: noteId → set of chunk hashes (via chunk content)
      // We use the first chunk's createdAt and content hash to detect changes
      const embeddingMap = new Map<string, { chunks: string[]; model: string }>();
      for (const entry of existingEmbeddings) {
        const existing = embeddingMap.get(entry.noteId);
        if (existing) {
          existing.chunks.push(entry.chunk);
        } else {
          embeddingMap.set(entry.noteId, { chunks: [entry.chunk], model: entry.model });
        }
      }

      targets = allNotes.filter(note => {
        const existing = embeddingMap.get(note.id);
        if (!existing) return true; // No embedding yet
        if (existing.model !== model) return true; // Different model
        
        // Compare content hash: hash the full text that would be embedded
        const textToEmbed = `${note.title}\n\n${note.content || ''}`.trim();
        const currentHash = hashContent(textToEmbed);
        const existingHash = hashContent(existing.chunks.join(''));
        
        // Simple heuristic: if the note content changed significantly, re-embed
        // We compare the hash of the current content vs stored chunks concatenated
        // More robust: compare content length + title
        const contentChanged = currentHash !== existingHash;
        if (!contentChanged) {
          skippedCount++;
          return false;
        }
        return true;
      });
    } catch {
      // If we can't load existing embeddings, just embed everything
      targets = allNotes;
    }
  }

  // Streaming response
  if (streaming) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const total = targets.length;
        const totalAll = allNotes.length;
        let processed = 0;
        const errors: string[] = [];

        // Send initial status
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'start', 
          total, 
          totalAll,
          skipped: skippedCount,
          model 
        })}\n\n`));

        for (const note of targets) {
          try {
            console.debug(`[Embed API] Starting note: ${note.title} (${note.id})`);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'progress', 
              current: processed + 1, 
              total, 
              totalAll,
              noteTitle: note.title,
              noteId: note.id,
              contentLength: note.content?.length || 0
            })}\n\n`));

            await upsertEmbeddingsForNote(safeBasePath, note, { model, host, chunkSize, chunkOverlap });
            processed++;

            console.debug(`[Embed API] Completed note: ${note.title}`);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'note_done', 
              noteId: note.id, 
              noteTitle: note.title 
            })}\n\n`));

          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
            const errorStack = err instanceof Error ? err.stack : '';
            console.error(`[Embed API] Error for ${note.title}:`, errorMsg, errorStack);
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
          totalAll,
          skipped: skippedCount,
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
      await upsertEmbeddingsForNote(safeBasePath, note, { model, host, chunkSize, chunkOverlap });
      updated.push(note.id);
    } catch (err) {
      errors.push(`${note.title}: ${err instanceof Error ? err.message : 'Fehler'}`);
    }
  }

  return NextResponse.json({
    updated,
    model,
    count: updated.length,
    skipped: skippedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
