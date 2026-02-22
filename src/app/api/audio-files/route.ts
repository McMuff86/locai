import { readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { apiError, apiSuccess } from '../_utils/responses';
import { assertLocalRequest } from '../_utils/security';

export const dynamic = 'force-dynamic';

const AUDIO_CACHE_DIR = path.join(homedir(), '.locai', 'audio');

/** GET /api/audio — list all cached audio files, newest first. */
export async function GET(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    let entries: string[];
    try {
      entries = readdirSync(AUDIO_CACHE_DIR);
    } catch {
      // Directory doesn't exist yet — no files
      return apiSuccess({ files: [] });
    }

    const AUDIO_EXTS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a']);

    const files = entries
      .filter((f) => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
      .map((filename) => {
        const filePath = path.join(AUDIO_CACHE_DIR, filename);
        const stat = statSync(filePath);
        return {
          filename,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return apiSuccess({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list audio files';
    return apiError(message, 500);
  }
}
