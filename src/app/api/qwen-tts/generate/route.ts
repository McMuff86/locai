import { QwenTTSClient } from '@/lib/qwenTTS';
import type { Language, Speaker, ModelSize } from '@/lib/qwenTTS';
import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { apiError, apiSuccess } from '../../_utils/responses';
import { assertLocalRequest } from '../../_utils/security';

export const dynamic = 'force-dynamic';

const AUDIO_CACHE_DIR = path.join(homedir(), '.locai', 'audio');

function ensureAudioCacheDir(): void {
  mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
}

function generateFilename(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}.wav`;
}

export async function POST(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const body = await request.json() as Record<string, unknown>;
    const text = body.text as string;
    const language = (body.language as Language) || 'German';
    const mode = (body.mode as string) || 'custom';
    const modelSize = (body.modelSize as ModelSize) || '1.7B';

    if (!text || typeof text !== 'string') {
      return apiError('"text" is required', 400);
    }

    let baseUrl = 'http://localhost:7861';
    try {
      const settingsRes = await fetch('http://localhost:3000/api/settings');
      const settingsData = await settingsRes.json();
      if (settingsData.success && settingsData.settings?.qwenTTSUrl) {
        baseUrl = settingsData.settings.qwenTTSUrl;
      }
    } catch {
      // use default
    }

    const client = new QwenTTSClient({ baseUrl });

    let result;
    switch (mode) {
      case 'clone':
        result = await client.cloneVoice({
          referenceAudio: body.referenceAudio as string,
          referenceText: body.referenceText as string,
          text,
          language,
          modelSize,
        });
        break;
      case 'design':
        result = await client.designVoice({
          text,
          language,
          voiceDescription: body.voiceDescription as string,
          modelSize,
        });
        break;
      case 'custom':
      default:
        result = await client.customVoice({
          text,
          language,
          speaker: (body.speaker as Speaker) || 'Vivian',
          instructText: (body.instructText as string) || '',
          modelSize,
        });
        break;
    }

    // Download and cache audio
    ensureAudioCacheDir();
    const filename = generateFilename();
    const filePath = path.join(AUDIO_CACHE_DIR, filename);
    const audioData = await client.downloadAudio(result.audioUrl);
    writeFileSync(filePath, Buffer.from(audioData));

    return apiSuccess({
      audioUrl: `/api/audio/${filename}`,
      duration: result.duration,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS generation failed';
    return apiError(message, 500);
  }
}
