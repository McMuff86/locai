// ============================================================================
// GET    /api/documents/[id]  – Get document details
// DELETE /api/documents/[id]  – Delete a specific document
// ============================================================================

import { NextRequest } from 'next/server';
import {
  getDocument,
  deleteDocument,
  renameDocument,
  loadDocumentEmbeddingsById,
} from '@/lib/documents/store';
import { apiError, apiSuccess } from '../../_utils/responses';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/[id]
 * Returns full document metadata + chunk count details.
 */
export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const doc = await getDocument(id);

    if (!doc) {
      return apiError('Dokument nicht gefunden', 404);
    }

    // Load embeddings to provide chunk info
    const embeddings = await loadDocumentEmbeddingsById(id);

    return apiSuccess({
      document: doc,
      chunks: embeddings.map((e, i) => ({
        id: e.id,
        index: i,
        preview: e.chunk.slice(0, 200) + (e.chunk.length > 200 ? '…' : ''),
        content: e.chunk,
        charCount: e.chunk.length,
        tokenEstimate: Math.ceil(e.chunk.length / 4),
        model: e.model,
        createdAt: e.createdAt,
      })),
      embeddingCount: embeddings.length,
    });
  } catch (err) {
    console.error('[Documents] Get error:', err);
    return apiError(
      err instanceof Error ? err.message : 'Dokument konnte nicht geladen werden',
      500,
    );
  }
}

/**
 * PATCH /api/documents/[id]
 * Rename a document.
 */
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError('Neuer Name fehlt oder ist ungültig', 400);
    }

    const doc = await renameDocument(id, name.trim());
    if (!doc) {
      return apiError('Dokument nicht gefunden', 404);
    }

    return apiSuccess({ document: doc });
  } catch (err) {
    console.error('[Documents] Rename error:', err);
    return apiError(
      err instanceof Error ? err.message : 'Umbenennen fehlgeschlagen',
      500,
    );
  }
}

/**
 * DELETE /api/documents/[id]
 * Removes the document, its embeddings, and uploaded file.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const deleted = await deleteDocument(id);

    if (!deleted) {
      return apiError('Dokument nicht gefunden', 404);
    }

    return apiSuccess({ id });
  } catch (err) {
    console.error('[Documents] Delete error:', err);
    return apiError(
      err instanceof Error ? err.message : 'Löschen fehlgeschlagen',
      500,
    );
  }
}
