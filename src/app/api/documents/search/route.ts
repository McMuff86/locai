// ============================================================================
// POST /api/documents/search  – Semantic search across documents
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { searchDocuments } from '@/lib/documents/rag';
import { DocumentType, SearchOptions } from '@/lib/documents/types';
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OLLAMA_HOST,
} from '@/lib/documents/constants';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const query: string | undefined = body.query;
    const topK: number | undefined = body.topK;
    const threshold: number | undefined = body.threshold;
    const documentIds: string[] | undefined = body.documentIds;
    const types: DocumentType[] | undefined = body.types;
    const model: string = body.model || DEFAULT_EMBEDDING_MODEL;
    const host: string = (body.host || DEFAULT_OLLAMA_HOST).replace(
      /\/$/,
      '',
    );

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Suchbegriff muss mindestens 2 Zeichen lang sein',
        },
        { status: 400 },
      );
    }

    const options: SearchOptions = {
      topK,
      threshold,
      documentIds,
      types,
      model,
      host,
    };

    const results = await searchDocuments(query.trim(), options);

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
      query: query.trim(),
    });
  } catch (err) {
    console.error('[DocSearch] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Suche fehlgeschlagen',
      },
      { status: 500 },
    );
  }
}
