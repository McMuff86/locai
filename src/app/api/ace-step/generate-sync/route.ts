import { AceStepClient } from '@/lib/aceStep';
import type { GenerateOptions } from '@/lib/aceStep';
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

/**
 * Build a human-readable filename from caption/description text.
 * E.g. "2026-02-22_chilligen-punkrocksong-catchy-refrain_a3f2.flac"
 */
function generateFilename(text: string | undefined, extension: string): string {
  const date = new Date().toISOString().slice(0, 10); // 2026-02-22
  const hash = Math.random().toString(36).slice(2, 6);

  let slug = 'untitled';
  if (text && text.trim()) {
    slug = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')   // strip non-alphanumeric
      .trim()
      .replace(/\s+/g, '-')           // spaces → hyphens
      .slice(0, 50)                    // truncate
      .replace(/-+$/, '');             // trim trailing hyphens
    if (!slug) slug = 'untitled';
  }

  return `${date}_${slug}_${hash}.${extension}`;
}

/**
 * POST /api/ace-step/generate-sync
 *
 * Synchronous generation flow:
 * 1. Call client.generate() (POST /release_task) — blocks while ACE-Step generates
 * 2. Poll client.getStatus() to retrieve audio paths
 * 3. Download audio files to ~/.locai/audio/ with meaningful names
 * 4. Return local audio URLs
 */
export async function POST(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const body = await request.json() as Record<string, unknown>;

    let baseUrl = 'http://localhost:8001';
    try {
      const settingsRes = await fetch('http://localhost:3000/api/settings');
      const settingsData = await settingsRes.json();
      if (settingsData.success && settingsData.settings?.aceStepUrl) {
        baseUrl = settingsData.settings.aceStepUrl;
      }
    } catch {
      // use default
    }

    const client = new AceStepClient({ baseUrl });

    // Backward-compat: map "caption"/"description" to "text2music"
    let taskType = (body.task_type as string) || 'caption';
    if (taskType === 'caption' || taskType === 'description') {
      taskType = 'text2music';
    }

    const options: GenerateOptions = {
      taskType: taskType as GenerateOptions['taskType'],
      caption: body.caption as string | undefined,
      lyrics: body.lyrics as string | undefined,
      description: body.description as string | undefined,
      duration: body.duration as number | undefined,
      bpm: body.bpm as number | undefined,
      batch: body.batch as number | undefined,
      srcAudioPath: body.src_audio_path as string | undefined,
      instrumental: body.instrumental as boolean | undefined,
      thinking: body.thinking as boolean | undefined,
      strength: body.strength as number | undefined,
      repaintStart: body.repainting_start as number | undefined,
      repaintEnd: body.repainting_end as number | undefined,
      seed: body.seed as number | undefined,
      numSteps: body.num_steps as number | undefined,
      cfgScale: body.cfg_scale as number | undefined,
    };

    // Derive a meaningful name from caption or description
    const nameSource = options.caption || options.description || options.lyrics || '';

    // Step 1: Trigger generation (this blocks while ACE-Step processes)
    const task = await client.generate(options);

    // Step 2: Poll for results with retries
    // ACE-Step completes synchronously during /release_task but may need
    // a moment to register the files in /query_result
    let results: Awaited<ReturnType<typeof client.getStatus>> = [];
    // ACE-Step with LLM thinking + DiT + VAE decode can take 60-120s
    const maxRetries = 60;
    const retryDelay = 3000;

    for (let i = 0; i < maxRetries; i++) {
      results = await client.getStatus(task.taskId);

      const hasAudio = results.some(r => r.status === 'success' && r.audioPath);
      if (hasAudio) break;

      const allFailed = results.length > 0 && results.every(r => r.status === 'failed');
      if (allFailed) {
        return apiError('All generation tasks failed', 500);
      }

      // Wait before retrying
      await new Promise(r => setTimeout(r, retryDelay));
    }

    const successResults = results.filter(r => r.status === 'success' && r.audioPath);

    if (successResults.length === 0) {
      return apiError('Generation completed but no audio files were produced', 500);
    }

    // Step 3: Download and cache all audio files with meaningful names
    ensureAudioCacheDir();
    const audioUrls: string[] = [];

    for (let i = 0; i < successResults.length; i++) {
      const result = successResults[i];
      // Detect extension from the audio path (default to flac)
      const ext = path.extname(result.audioPath || '').replace('.', '') || 'flac';
      const suffix = successResults.length > 1 ? `${nameSource} part${i + 1}` : nameSource;
      const filename = generateFilename(suffix, ext);
      const filePath = path.join(AUDIO_CACHE_DIR, filename);
      const audioData = await client.downloadAudio(result.audioPath!);
      writeFileSync(filePath, Buffer.from(audioData));
      audioUrls.push(`/api/audio/${filename}`);
    }

    return apiSuccess({ audioUrls });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Music generation failed';
    return apiError(message, 500);
  }
}
