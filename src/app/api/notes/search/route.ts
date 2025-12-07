import { NextRequest, NextResponse } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { basicSearch, semanticSearch } from '@/lib/notes/search';
import { embedQuery, loadEmbeddings } from '@/lib/notes/embeddings';
import { EmbeddingSearchResult, Note } from '@/lib/notes/types';

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

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const storage = new FileNoteStorage(basePath);
  const summaries = await storage.listNotes();
  const resolved = await Promise.all(summaries.map((s) => storage.getNote(s.id)));
  const notes = resolved.filter((note): note is Note => Boolean(note));

  const lexical = basicSearch(notes, query, topK);

  let semantic: EmbeddingSearchResult[] = [];
  let embeddingsUsed = false;

  if (useEmbeddings) {
    const entries = await loadEmbeddings(basePath);
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


