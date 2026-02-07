// ============================================================================
// GET    /api/documents/[id]  – Get document details
// DELETE /api/documents/[id]  – Delete a specific document
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getDocument,
  deleteDocument,
  loadDocumentEmbeddingsById,
} from '@/lib/documents/store';

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
      return NextResponse.json(
        { success: false, error: 'Dokument nicht gefunden' },
        { status: 404 },
      );
    }

    // Load embeddings to provide chunk info
    const embeddings = await loadDocumentEmbeddingsById(id);

    return NextResponse.json({
      success: true,
      document: doc,
      chunks: embeddings.map((e) => ({
        id: e.id,
        preview: e.chunk.slice(0, 200) + (e.chunk.length > 200 ? '...' : ''),
        model: e.model,
        createdAt: e.createdAt,
      })),
      embeddingCount: embeddings.length,
    });
  } catch (err) {
    console.error('[Documents] Get error:', err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Dokument konnte nicht geladen werden',
      },
      { status: 500 },
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
      return NextResponse.json(
        { success: false, error: 'Dokument nicht gefunden' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('[Documents] Delete error:', err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : 'Löschen fehlgeschlagen',
      },
      { status: 500 },
    );
  }
}
