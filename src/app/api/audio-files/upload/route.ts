import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { apiError, apiSuccess } from '../../_utils/responses';
import { assertLocalRequest, validatePath } from '../../_utils/security';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(homedir(), '.locai', 'audio', 'uploads');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const ACCEPTED_EXTENSIONS = new Set(['.wav', '.mp3', '.flac', '.ogg', '.m4a']);

function ensureUploadDir(): void {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * POST /api/audio-files/upload
 *
 * Accepts multipart/form-data with a single 'file' field.
 * Saves the file to ~/.locai/audio/uploads/ and returns the absolute path
 * (needed by ACE-Step for remix/repaint source audio).
 */
export async function POST(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return apiError('No file provided', 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`, 400);
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      return apiError(
        `Unsupported file type "${ext}". Accepted: ${[...ACCEPTED_EXTENSIONS].join(', ')}`,
        400,
      );
    }

    // Generate safe filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
    const filename = `${timestamp}_${random}_${safeName}`;

    ensureUploadDir();

    const filePath = path.join(UPLOAD_DIR, filename);

    // Path traversal check
    const validated = validatePath(filePath, UPLOAD_DIR);
    if (!validated) {
      return apiError('Invalid file path', 400);
    }

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(validated, buffer);

    return apiSuccess({
      filePath: validated,
      filename,
      size: file.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return apiError(message, 500);
  }
}
