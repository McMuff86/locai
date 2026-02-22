import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { apiError, apiSuccess } from '../../_utils/responses';
import { assertLocalRequest } from '../../_utils/security';
import { resolveWorkspacePath } from '@/lib/settings/store';

export const dynamic = 'force-dynamic';

const AUDIO_CACHE_DIR = path.join(homedir(), '.locai', 'audio');

/**
 * POST /api/audio-files/save-to-workspace
 * Copies an audio file from ~/.locai/audio/ to the workspace directory.
 */
export async function POST(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const { filename } = (await request.json()) as { filename: string };

    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('\0')
    ) {
      return apiError('Invalid filename', 400);
    }

    const sourcePath = path.join(AUDIO_CACHE_DIR, filename);
    const resolvedSource = path.resolve(sourcePath);
    if (!resolvedSource.startsWith(path.resolve(AUDIO_CACHE_DIR))) {
      return apiError('Invalid filename', 400);
    }

    if (!existsSync(resolvedSource)) {
      return apiError('Audio file not found', 404);
    }

    const workspace = resolveWorkspacePath();
    if (!workspace) {
      return apiError('Workspace path not configured', 500);
    }

    const audioDir = path.join(workspace, 'audio');
    mkdirSync(audioDir, { recursive: true });

    const destPath = path.join(audioDir, filename);
    copyFileSync(resolvedSource, destPath);

    return apiSuccess({ savedTo: destPath });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save audio file';
    return apiError(message, 500);
  }
}
