import { readdirSync, statSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { apiError, apiSuccess } from '../_utils/responses';
import { assertLocalRequest, sanitizeBasePath } from '../_utils/security';

export const dynamic = 'force-dynamic';

const AUDIO_CACHE_DIR = path.join(homedir(), '.locai', 'audio');
const WORKSPACE_AUDIO_DIR = path.join(homedir(), '.locai', 'workspace', 'audio');

const AUDIO_EXTS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.opus', '.aac', '.wma']);

interface AudioFileEntry {
  filename: string;
  size: number;
  createdAt: string;
  source: string;       // 'generated' | 'workspace' | 'custom'
  fullPath: string;     // needed for serving files from non-default dirs
}

/** Scan a directory for audio files */
function scanAudioDir(dir: string, source: string): AudioFileEntry[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
      .map((filename) => {
        const filePath = path.join(dir, filename);
        const stat = statSync(filePath);
        return {
          filename,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          source,
          fullPath: filePath,
        };
      });
  } catch {
    return [];
  }
}

/**
 * GET /api/audio-files — list audio files from multiple sources.
 * 
 * Sources (always scanned):
 *   1. ~/.locai/audio/ (generated files)
 *   2. ~/.locai/workspace/audio/ (workspace files)
 * 
 * Optional query param:
 *   ?extraDir=C:\path\to\music  — scan an additional custom folder
 */
export async function GET(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    // Always scan default directories
    const files: AudioFileEntry[] = [
      ...scanAudioDir(AUDIO_CACHE_DIR, 'generated'),
      ...scanAudioDir(WORKSPACE_AUDIO_DIR, 'workspace'),
    ];

    // Optional: scan a custom directory
    const url = new URL(request.url);
    const extraDir = url.searchParams.get('extraDir');
    if (extraDir) {
      const sanitized = sanitizeBasePath(extraDir);
      if (sanitized && existsSync(sanitized)) {
        files.push(...scanAudioDir(sanitized, 'custom'));
      }
    }

    // Sort newest first, deduplicate by filename (prefer generated over workspace)
    const seen = new Set<string>();
    const deduplicated = files
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((f) => {
        if (seen.has(f.filename)) return false;
        seen.add(f.filename);
        return true;
      });

    return apiSuccess({ files: deduplicated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list audio files';
    return apiError(message, 500);
  }
}
