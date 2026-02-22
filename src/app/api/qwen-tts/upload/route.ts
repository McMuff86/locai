import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { apiError, apiSuccess } from '../../_utils/responses';
import { assertLocalRequest } from '../../_utils/security';

export const dynamic = 'force-dynamic';

const REFERENCES_DIR = path.join(homedir(), '.locai', 'audio', 'references');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/ogg',
  'audio/flac',
  'audio/webm',
]);

const MIME_TO_EXT: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/webm': 'webm',
};

/**
 * POST /api/qwen-tts/upload
 *
 * Accepts a multipart `file` field containing an audio file and saves it to
 * the local references directory (`~/.locai/audio/references/`).
 * Used for uploading voice-cloning reference audio.
 *
 * @returns `{ filePath }` on success.
 */
export async function POST(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return apiError('No audio file provided', 400);
    }

    // MIME type check
    const mimeType = file.type;
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return apiError(`Unsupported file type: ${mimeType}`, 400);
    }

    // Size check
    if (file.size > MAX_FILE_SIZE) {
      return apiError(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`, 400);
    }

    const ext = MIME_TO_EXT[mimeType] || 'wav';
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    const filename = `ref-${timestamp}-${random}.${ext}`;

    // Path traversal protection: filename is fully generated, no user input in path
    mkdirSync(REFERENCES_DIR, { recursive: true });
    const filePath = path.join(REFERENCES_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(filePath, buffer);

    return apiSuccess({ filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return apiError(message, 500);
  }
}
