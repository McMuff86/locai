import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { getFileStream } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

const MIME_MAP: Record<string, string> = {
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.flac': 'audio/flac',
  '.ogg':  'audio/ogg',
  '.aac':  'audio/aac',
  '.m4a':  'audio/mp4',
  '.wma':  'audio/x-ms-wma',
  '.opus': 'audio/opus',
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

    // Handle Range requests for audio seeking
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : size - 1;

        if (start >= size || end >= size || start > end) {
          return new NextResponse(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${size}` },
          });
        }

        const chunkSize = end - start + 1;
        const stream = createReadStream(filePath, { start, end });

        return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(chunkSize),
            'Accept-Ranges': 'bytes',
          },
        });
      }
    }

    // Full file response
    const stream = createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error('[FileBrowser] Audio serve error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 },
    );
  }
}
