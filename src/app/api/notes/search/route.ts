import { NextRequest } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { basicSearch, semanticSearch } from '@/lib/notes/search';
import { embedQuery, loadEmbeddings } from '@/lib/notes/embeddings';
import { EmbeddingSearchResult, Note } from '@/lib/notes/types';
import { sanitizeBasePath } from '../../_utils/security';
import { resolveAndValidateOllamaHost } from '../../_utils/ollama';
import { apiError, apiSuccess } from '../../_utils/responses';

export const runtime = 'nodejs';

function getBasePath(req: NextRequest, bodyBasePath?: string | null): string | null {
  return (
    bodyBasePath ||
    req.nextUrl.searchParams.get('basePath') ||
    req.headers.get('x-notes-path') ||
    process.env.LOCAL_NOTES_PATH ||
    null
  );
}

// GET method for unified search
export async function GET(req: NextRequest) {
  const rawBasePath = getBasePath(req);
  const query = req.nextUrl.searchParams.get('query');
  
  if (!rawBasePath) {
    return apiError('basePath is required', 400);
  }
  // SEC-2: Validate basePath (no traversal)
  const basePath = sanitizeBasePath(rawBasePath);
  if (!basePath) {
    return apiError('Invalid basePath', 400);
  }

  if (!query || query.length < 2) {
    return apiSuccess({ results: [] });
  }
  
  try {
    const storage = new FileNoteStorage(basePath);
    const summaries = await storage.listNotes();
    const resolved = await Promise.all(summaries.map((s) => storage.getNote(s.id)));
    const notes = resolved.filter((note): note is Note => Boolean(note));
    
    const lowerQuery = query.toLowerCase();
    const results: Array<{
      noteId: string;
      title: string;
      snippet: string;
      matchType: 'title' | 'content' | 'tag';
      tags?: string[];
      score: number;
    }> = [];
    
    for (const note of notes) {
      let matchType: 'title' | 'content' | 'tag' | null = null;
      let snippet = '';
      let score = 0;
      
      // Check title
      if (note.title.toLowerCase().includes(lowerQuery)) {
        matchType = 'title';
        score = 100;
        // Create snippet from content
        if (note.content) {
          const contentStart = note.content.slice(0, 200);
          snippet = contentStart + (note.content.length > 200 ? '...' : '');
        }
      }
      
      // Check content
      if (!matchType && note.content) {
        const lowerContent = note.content.toLowerCase();
        const index = lowerContent.indexOf(lowerQuery);
        if (index !== -1) {
          matchType = 'content';
          score = 50;
          // Create snippet around match
          const start = Math.max(0, index - 80);
          const end = Math.min(note.content.length, index + query.length + 80);
          snippet = (start > 0 ? '...' : '') + 
            note.content.slice(start, end) + 
            (end < note.content.length ? '...' : '');
        }
      }
      
      // Check tags
      if (!matchType && note.tags) {
        if (note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
          matchType = 'tag';
          score = 30;
          snippet = `Tags: ${note.tags.join(', ')}`;
        }
      }
      
      if (matchType) {
        results.push({
          noteId: note.id,
          title: note.title || 'Unbenannte Notiz',
          snippet,
          matchType,
          tags: note.tags,
          score,
        });
      }
    }
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    return apiSuccess({ results });
  } catch (error) {
    console.error('Search error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Search failed',
      500,
      { results: [] },
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query: string | undefined = body.query;
  const basePath = getBasePath(req, body.basePath || null);
  const topK: number = body.topK || 10;
  const useEmbeddings: boolean = body.useEmbeddings ?? true;
  const model: string | undefined = body.model;

  // SSRF: validate user-supplied Ollama host
  let host: string | undefined;
  if (body.host) {
    try {
      host = resolveAndValidateOllamaHost(body.host);
    } catch (err) {
      return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
    }
  }

  if (!basePath) {
    return apiError('basePath is required', 400);
  }

  // SEC-2: Validate basePath (no traversal)
  const safeBasePath = sanitizeBasePath(basePath);
  if (!safeBasePath) {
    return apiError('Invalid basePath', 400);
  }

  if (!query || typeof query !== 'string') {
    return apiError('query is required', 400);
  }

  const storage = new FileNoteStorage(safeBasePath);
  const summaries = await storage.listNotes();
  const resolved = await Promise.all(summaries.map((s) => storage.getNote(s.id)));
  const notes = resolved.filter((note): note is Note => Boolean(note));

  const lexical = basicSearch(notes, query, topK);

  let semantic: EmbeddingSearchResult[] = [];
  let embeddingsUsed = false;

  if (useEmbeddings) {
    const entries = await loadEmbeddings(safeBasePath);
    if (entries.length > 0) {
      try {
        const vector = await embedQuery(query, { host, model });
        semantic = semanticSearch(entries, vector, topK);
        embeddingsUsed = true;
      } catch (error) {
        console.error('Semantic search failed:', error);
      }
    }
  }

  return apiSuccess({
    lexical,
    semantic,
    embeddingsUsed,
  });
}


