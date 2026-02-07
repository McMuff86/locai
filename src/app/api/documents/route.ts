// ============================================================================
// GET  /api/documents       – List all documents
// DELETE /api/documents     – Remove a document (via ?id=xxx query param)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { loadDocuments, deleteDocument } from '@/lib/documents/store';

export const runtime = 'nodejs';

/**
 * GET /api/documents
 * Returns a list of all uploaded documents.
 */
export async function GET() {
  try {
    const docs = await loadDocuments();

    // Sort by upload date descending (newest first)
    docs.sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );

    return NextResponse.json({
      success: true,
      documents: docs,
      count: docs.length,
    });
  } catch (err) {
    console.error('[Documents] List error:', err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : 'Dokumente konnten nicht geladen werden',
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/documents?id=xxx
 * Removes a document, its embeddings, and uploaded file.
 */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Dokument-ID fehlt (query param: id)' },
        { status: 400 },
      );
    }

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
