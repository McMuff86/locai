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

    const ext = relativePath.includes('.')
      ? relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase()
      : '';

    if (ext !== '.pdf') {
      return NextResponse.json(
        { success: false, error: 'Nur PDF-Dateien werden unterstützt' },
        { status: 400 },
      );
    }

    const { filePath, size } = await getFileStream(rootId, relativePath);
    const stream = createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': size.toString(),
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error('[FileBrowser] PDF serve error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 },
    );
  }
}
