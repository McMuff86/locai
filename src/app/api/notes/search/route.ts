import { NextRequest, NextResponse } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { basicSearch, semanticSearch } from '@/lib/notes/search';
import { embedQuery, loadEmbeddings } from '@/lib/notes/embeddings';
import { EmbeddingSearchResult, Note } from '@/lib/notes/types';
import { sanitizeBasePath } from '../../_utils/security';

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
    return NextResponse.json({ success: false, error: 'basePath is required' }, { status: 400 });
  }
  // SEC-2: Validate basePath (no traversal)
  const basePath = sanitizeBasePath(rawBasePath);
  if (!basePath) {
    return NextResponse.json({ success: false, error: 'Invalid basePath' }, { status: 400 });
  }
  
  if (!query || query.length < 2) {
    return NextResponse.json({ success: true, results: [] });
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
    
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Search failed',
      results: []
    });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query: string | undefined = body.query;
  const basePath = getBasePath(req, body.basePath || null);
  const topK: number = body.topK || 10;
  const useEmbeddings: boolean = body.useEmbeddings ?? true;
  const host: string | undefined = body.host;
  const model: string | undefined = body.model;

  if (!basePath) {
    return NextResponse.json({ error: 'basePath is required' }, { status: 400 });
  }

  // SEC-2: Validate basePath (no traversal)
  const safeBasePath = sanitizeBasePath(basePath);
  if (!safeBasePath) {
    return NextResponse.json({ error: 'Invalid basePath' }, { status: 400 });
  }

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
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

  return NextResponse.json({
    lexical,
    semantic,
    embeddingsUsed,
  });
}


