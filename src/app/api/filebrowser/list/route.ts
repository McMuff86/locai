import { NextRequest, NextResponse } from 'next/server';
import { listDirectory } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const rootId = req.nextUrl.searchParams.get('rootId');
    const relativePath = req.nextUrl.searchParams.get('path') || '';
    const includeChildCount = req.nextUrl.searchParams.get('includeChildCount') === 'true';

    if (!rootId) {
      return NextResponse.json(
        { success: false, error: 'rootId fehlt' },
        { status: 400 },
      );
    }

    const entries = await listDirectory(rootId, relativePath, { includeChildCount });

    return NextResponse.json({
      success: true,
      entries,
      currentPath: relativePath,
      rootId,
    });
  } catch (err) {
    console.error('[FileBrowser] List error:', err);
    const message = err instanceof Error ? err.message : 'Fehler beim Auflisten';
    const status = message === 'Ungültiger Pfad' ? 400 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status },
    );
  }
}
