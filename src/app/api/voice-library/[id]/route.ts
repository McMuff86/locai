import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { apiError, apiSuccess } from '../../_utils/responses';
import { assertLocalRequest } from '../../_utils/security';

export const dynamic = 'force-dynamic';

const VOICES_DIR = path.join(homedir(), '.locai', 'voices');

interface VoiceMetadata {
  id: string;
  name: string;
  description: string;
  referenceAudioPath: string;
  referenceText: string;
  createdAt: string;
  updatedAt: string;
}

function readVoiceMetadata(id: string): VoiceMetadata | null {
  if (id.includes('..') || id.includes('/') || id.includes('\\')) return null;
  const metaPath = path.join(VOICES_DIR, id, 'metadata.json');
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8')) as VoiceMetadata;
  } catch {
    return null;
  }
}

/** GET /api/voice-library/[id] */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  const { id } = await params;
  const voice = readVoiceMetadata(id);
  if (!voice) return apiError('Voice not found', 404);
  return apiSuccess({ voice });
}

/** PUT /api/voice-library/[id] */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  const { id } = await params;
  const voice = readVoiceMetadata(id);
  if (!voice) return apiError('Voice not found', 404);

  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.name !== undefined) voice.name = body.name as string;
    if (body.description !== undefined) voice.description = body.description as string;
    if (body.referenceText !== undefined) voice.referenceText = body.referenceText as string;
    voice.updatedAt = new Date().toISOString();

    const metaPath = path.join(VOICES_DIR, id, 'metadata.json');
    writeFileSync(metaPath, JSON.stringify(voice, null, 2));
    return apiSuccess({ voice });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update voice';
    return apiError(message, 500);
  }
}

/** DELETE /api/voice-library/[id] */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  const { id } = await params;
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    return apiError('Invalid voice ID', 400);
  }

  const voiceDir = path.join(VOICES_DIR, id);
  if (!existsSync(voiceDir)) return apiError('Voice not found', 404);

  try {
    rmSync(voiceDir, { recursive: true, force: true });
    return apiSuccess({ deleted: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete voice';
    return apiError(message, 500);
  }
}
