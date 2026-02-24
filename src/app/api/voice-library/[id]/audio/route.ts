import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { NextResponse } from 'next/server';
import { assertLocalRequest } from '../../../_utils/security';

export const dynamic = 'force-dynamic';

const VOICES_DIR = path.join(homedir(), '.locai', 'voices');

interface VoiceMetadata {
  referenceAudioPath: string;
}

/** GET /api/voice-library/[id]/audio — Serve reference audio */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  const { id } = await params;
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const metaPath = path.join(VOICES_DIR, id, 'metadata.json');
  if (!existsSync(metaPath)) {
    return NextResponse.json({ error: 'Voice not found' }, { status: 404 });
  }

  let meta: VoiceMetadata;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as VoiceMetadata;
  } catch {
    return NextResponse.json({ error: 'Invalid metadata' }, { status: 500 });
  }

  const audioPath = meta.referenceAudioPath;
  if (!audioPath || !existsSync(audioPath)) {
    return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
  }

  const ext = path.extname(audioPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm',
  };

  const buffer = readFileSync(audioPath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeMap[ext] || 'audio/wav',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
