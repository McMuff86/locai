import { NextRequest, NextResponse } from 'next/server';
import { assertLocalRequest } from '@/app/api/_utils/security';
import { deleteFile } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest) {
  const forbidden = assertLocalRequest(req);
  if (forbidden) return forbidden;

  try {
    const rootId = req.nextUrl.searchParams.get('rootId');
    const relativePath = req.nextUrl.searchParams.get('path') || '';

    if (!rootId || !relativePath) {
      return NextResponse.json(
        { success: false, error: 'rootId und path sind erforderlich' },
        { status: 400 },
      );
    }

    if (rootId !== 'workspace') {
      return NextResponse.json(
        { success: false, error: 'Löschen ist nur im Workspace erlaubt' },
        { status: 403 },
      );
    }

    await deleteFile(rootId, relativePath);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[FileBrowser] Delete error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler beim Löschen' },
      { status: 500 },
    );
  }
}
