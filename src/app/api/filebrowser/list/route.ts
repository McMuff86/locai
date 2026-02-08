import { NextRequest, NextResponse } from 'next/server';
import { listDirectory } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const rootId = req.nextUrl.searchParams.get('rootId');
    const relativePath = req.nextUrl.searchParams.get('path') || '';

    if (!rootId) {
      return NextResponse.json(
        { success: false, error: 'rootId fehlt' },
        { status: 400 },
      );
    }

    const entries = await listDirectory(rootId, relativePath);

    return NextResponse.json({
      success: true,
      entries,
      currentPath: relativePath,
      rootId,
    });
  } catch (err) {
    console.error('[FileBrowser] List error:', err);
    const status = (err instanceof Error && err.message === 'Ungültiger Pfad') ? 400 : 500;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler beim Auflisten' },
      { status },
    );
  }
}
