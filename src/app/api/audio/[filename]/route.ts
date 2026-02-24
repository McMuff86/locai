import { existsSync, statSync, createReadStream } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AUDIO_CACHE_DIR = path.join(homedir(), '.locai', 'audio');
const WORKSPACE_AUDIO_DIR = path.join(homedir(), '.locai', 'workspace', 'audio');

/**
 * Serve cached audio files with Range header support.
 * Searches in: ~/.locai/audio/ then ~/.locai/workspace/audio/
 * Also supports ?dir= query param for custom source directories.
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

  // Search multiple directories for the file
  const searchDirs = [AUDIO_CACHE_DIR, WORKSPACE_AUDIO_DIR];

  // Support custom dir via query param
  const url = new URL(request.url);
  const customDir = url.searchParams.get('dir');
  if (customDir && !customDir.includes('..')) {
    searchDirs.push(path.resolve(customDir));
  }

  let filePath = '';
  for (const dir of searchDirs) {
    const candidate = path.join(dir, filename);
    const resolved = path.resolve(candidate);
    // Ensure resolved path stays within the search dir
    if (resolved.startsWith(path.resolve(dir)) && existsSync(candidate)) {
      filePath = candidate;
      break;
    }
  }

  if (!filePath) {
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
    '.opus': 'audio/opus',
    '.aac': 'audio/aac',
    '.wma': 'audio/x-ms-wma',
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
          let closed = false;
          stream.on('data', (chunk: Buffer | string) => {
            if (!closed) controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          });
          stream.on('end', () => { if (!closed) { closed = true; controller.close(); } });
          stream.on('error', (err) => { if (!closed) { closed = true; controller.error(err); } });
        },
        cancel() { stream.destroy(); },
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
      let closed = false;
      stream.on('data', (chunk: Buffer | string) => {
        if (!closed) controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      });
      stream.on('end', () => { if (!closed) { closed = true; controller.close(); } });
      stream.on('error', (err) => { if (!closed) { closed = true; controller.error(err); } });
    },
    cancel() { stream.destroy(); },
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
