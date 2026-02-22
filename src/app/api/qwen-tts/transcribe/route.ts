import { QwenTTSClient } from '@/lib/qwenTTS';
import { apiError, apiSuccess } from '../../_utils/responses';
import { assertLocalRequest, validatePath } from '../../_utils/security';
import { homedir } from 'os';
import path from 'path';

export const dynamic = 'force-dynamic';

const REFERENCES_DIR = path.join(homedir(), '.locai', 'audio', 'references');

/**
 * POST /api/qwen-tts/transcribe
 *
 * Transcribes a previously uploaded reference audio file via the Qwen3-TTS
 * service. Expects `{ filePath }` in the JSON body pointing to a file inside
 * `~/.locai/audio/references/`.
 *
 * @returns `{ text }` — the transcribed text.
 */
export async function POST(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const body = await request.json() as Record<string, unknown>;
    const filePath = body.filePath as string;

    if (!filePath || typeof filePath !== 'string') {
      return apiError('"filePath" is required', 400);
    }

    // Validate path stays within references directory
    const validated = validatePath(filePath, REFERENCES_DIR);
    if (!validated) {
      return apiError('Invalid file path', 400);
    }

    let baseUrl = 'http://localhost:7861';
    try {
      const settingsRes = await fetch('http://localhost:3000/api/settings');
      const settingsData = await settingsRes.json() as { success: boolean; settings?: { qwenTTSUrl?: string } };
      if (settingsData.success && settingsData.settings?.qwenTTSUrl) {
        baseUrl = settingsData.settings.qwenTTSUrl;
      }
    } catch {
      // use default
    }

    const client = new QwenTTSClient({ baseUrl });
    const result = await client.transcribe(validated);

    return apiSuccess({ text: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    return apiError(message, 500);
  }
}
