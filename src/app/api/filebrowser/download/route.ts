import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { getFileStream } from '@/lib/filebrowser/scanner';

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

    const { filePath, fileName, size } = await getFileStream(rootId, relativePath);
    const stream = createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': size.toString(),
      },
    });
  } catch (err) {
    console.error('[FileBrowser] Download error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler beim Herunterladen' },
      { status: 500 },
    );
  }
}
