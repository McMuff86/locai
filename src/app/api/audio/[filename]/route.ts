import { existsSync, statSync, createReadStream } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AUDIO_CACHE_DIR = path.join(homedir(), '.locai', 'audio');

/**
 * Serve cached audio files with Range header support.
 * Path traversal protection: reject any filename containing '..' or '/'.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Path traversal protection
  if (
    !filename ||
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0')
  ) {
    return NextResponse.json({ success: false, error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(AUDIO_CACHE_DIR, filename);

  // Ensure resolved path is still within cache dir
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(AUDIO_CACHE_DIR))) {
    return NextResponse.json({ success: false, error: 'Invalid filename' }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;

  // Determine content type
  const ext = path.extname(filename).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
  };
  const contentType = contentTypeMap[ext] || 'application/octet-stream';

  // Handle Range requests for streaming
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const chunkSize = end - start + 1;
      const stream = createReadStream(filePath, { start, end });
      const readable = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: Buffer | string) => controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
          stream.on('end', () => controller.close());
          stream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(readable, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': String(chunkSize),
          'Accept-Ranges': 'bytes',
        },
      });
    }
  }

  // Full file response
  const stream = createReadStream(filePath);
  const readable = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk: Buffer | string) => controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
  });

  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
    },
  });
}
