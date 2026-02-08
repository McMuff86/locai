import { NextRequest, NextResponse } from 'next/server';
import { readFileContent } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const rootId = req.nextUrl.searchParams.get('rootId');
    const relativePath = req.nextUrl.searchParams.get('path') || '';

    if (!rootId || !relativePath) {
      return NextResponse.json(
        { success: false, error: 'rootId und path sind erforderlich' },
        { status: 400 },
      );
    }

    const result = await readFileContent(rootId, relativePath);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[FileBrowser] Read error:', err);
    const status = (err instanceof Error && err.message.includes('Binär')) ? 415 : 500;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler beim Lesen' },
      { status },
    );
  }
}
