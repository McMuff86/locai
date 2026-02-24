import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { apiError, apiSuccess } from '../_utils/responses';
import { assertLocalRequest } from '../_utils/security';

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

function ensureVoicesDir(): void {
  mkdirSync(VOICES_DIR, { recursive: true });
}

function getVoiceDir(id: string): string {
  return path.join(VOICES_DIR, id);
}

function readVoiceMetadata(id: string): VoiceMetadata | null {
  const metaPath = path.join(getVoiceDir(id), 'metadata.json');
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8')) as VoiceMetadata;
  } catch {
    return null;
  }
}

function writeVoiceMetadata(voice: VoiceMetadata): void {
  const dir = getVoiceDir(voice.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(voice, null, 2));
}

function listAllVoices(): VoiceMetadata[] {
  ensureVoicesDir();
  if (!existsSync(VOICES_DIR)) return [];
  const entries = readdirSync(VOICES_DIR, { withFileTypes: true });
  const voices: VoiceMetadata[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const meta = readVoiceMetadata(entry.name);
      if (meta) voices.push(meta);
    }
  }
  return voices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `voice-${timestamp}-${random}`;
}

/** GET /api/voice-library — List all voices */
export async function GET(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const voices = listAllVoices();
    return apiSuccess({ voices });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list voices';
    return apiError(message, 500);
  }
}

/** POST /api/voice-library — Create a new voice */
export async function POST(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const body = await request.json() as Record<string, unknown>;
    const name = body.name as string;
    const description = (body.description as string) || '';
    const referenceAudioPath = body.referenceAudioPath as string;
    const referenceText = (body.referenceText as string) || '';

    if (!name || typeof name !== 'string') {
      return apiError('"name" is required', 400);
    }
    if (!referenceAudioPath || typeof referenceAudioPath !== 'string') {
      return apiError('"referenceAudioPath" is required', 400);
    }
    if (!existsSync(referenceAudioPath)) {
      return apiError('Reference audio file not found', 400);
    }

    const id = generateId();
    const voiceDir = getVoiceDir(id);
    mkdirSync(voiceDir, { recursive: true });

    const ext = path.extname(referenceAudioPath) || '.wav';
    const audioFilename = `reference${ext}`;
    const localAudioPath = path.join(voiceDir, audioFilename);
    copyFileSync(referenceAudioPath, localAudioPath);

    const now = new Date().toISOString();
    const voice: VoiceMetadata = {
      id,
      name,
      description,
      referenceAudioPath: localAudioPath,
      referenceText,
      createdAt: now,
      updatedAt: now,
    };

    writeVoiceMetadata(voice);
    return apiSuccess({ voice });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create voice';
    return apiError(message, 500);
  }
}
