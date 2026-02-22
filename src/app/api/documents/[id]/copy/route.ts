// ============================================================================
// POST /api/documents/[id]/copy – Duplicate a document
// ============================================================================

import { NextRequest } from 'next/server';
import { copyDocument } from '@/lib/documents/store';
import { apiError, apiSuccess } from '../../../_utils/responses';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/documents/[id]/copy
 * Creates a full copy of the document (metadata, file, embeddings).
 * Optionally accepts `{ name: "Custom Name" }` in the request body.
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;

    let customName: string | undefined;
    try {
      const body = await req.json();
      if (body.name && typeof body.name === 'string') {
        customName = body.name.trim() || undefined;
      }
    } catch {
      // No body or invalid JSON is fine – use default name
    }

    const newDoc = await copyDocument(id, customName);
    if (!newDoc) {
      return apiError('Dokument nicht gefunden', 404);
    }

    return apiSuccess({ document: newDoc });
  } catch (err) {
    console.error('[Documents] Copy error:', err);
    return apiError(
      err instanceof Error ? err.message : 'Kopieren fehlgeschlagen',
      500,
    );
  }
}
