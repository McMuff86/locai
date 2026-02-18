import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { getFileStream } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

const MIME_MAP: Record<string, string> = {
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico':  'image/x-icon',
};

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

    const contentType = MIME_MAP[ext] ?? 'application/octet-stream';

    const { filePath, size } = await getFileStream(rootId, relativePath);
    const stream = createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': size.toString(),
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error('[FileBrowser] Image serve error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 },
    );
  }
}
