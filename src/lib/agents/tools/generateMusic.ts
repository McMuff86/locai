// ============================================================================
// Built-in Tool: generate_music
// ============================================================================
// Generates music using the local ACE-Step AI music generation service.
// ============================================================================

import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { AceStepClient } from '../../aceStep';
import { RegisteredTool, ToolResult } from '../types';

/** Directory for caching downloaded audio files locally. */
const AUDIO_CACHE_DIR = path.join(homedir(), '.locai', 'audio');

/** Ensures the audio cache directory exists, creating it recursively if needed. */
function ensureAudioCacheDir(): void {
  mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
}

/** Generates a unique filename for a cached audio file using timestamp and random suffix. */
function generateFilename(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}.wav`;
}

/** Retrieves the ACE-Step service URL from app settings, falling back to localhost:8001. */
async function getAceStepUrl(): Promise<string> {
  try {
    const res = await fetch('http://localhost:3000/api/settings');
    const data = await res.json();
    if (data.success && data.settings?.aceStepUrl) {
      return data.settings.aceStepUrl;
    }
  } catch {
    // Fall through to default
  }
  return 'http://localhost:8001';
}

/**
 * Agent tool for generating music via the local ACE-Step service.
 * Supports text2music, remix, and repaint modes with configurable parameters.
 */
const generateMusicTool: RegisteredTool = {
  definition: {
    name: 'generate_music',
    description:
      'Generate music using the local ACE-Step AI music generation service. ' +
      'Supports text-to-music generation, remixing existing audio, and repainting audio segments. ' +
      'Provide a caption describing the music, optional lyrics, and configure generation parameters. ' +
      'Returns audio file URLs when generation completes.',
    parameters: {
      type: 'object',
      properties: {
        caption: {
          type: 'string',
          description: 'Text description of the music to generate',
        },
        lyrics: {
          type: 'string',
          description: 'Lyrics to set to music',
        },
        duration: {
          type: 'number',
          description: 'Duration in seconds (default: 30, max: 300)',
        },
        bpm: {
          type: 'integer',
          description: 'Beats per minute (default: 120)',
        },
        task_type: {
          type: 'string',
          enum: ['text2music', 'remix', 'repaint', 'caption', 'description'],
          description: 'Generation mode: "text2music" for text prompt (default), "remix" for remixing, "repaint" for repainting. Legacy: "caption" and "description" map to "text2music".',
        },
        batch: {
          type: 'integer',
          description: 'Number of variations to generate (default: 1, max: 4)',
        },
        instrumental: {
          type: 'boolean',
          description: 'Generate instrumental only, no vocals (default: false)',
        },
        src_audio_path: {
          type: 'string',
          description: 'Source audio file path for remix/repaint modes',
        },
        strength: {
          type: 'number',
          description: 'Remix strength 0-1 (default: 0.5, only for remix mode)',
        },
        repainting_start: {
          type: 'number',
          description: 'Repaint start time in seconds (only for repaint mode)',
        },
        repainting_end: {
          type: 'number',
          description: 'Repaint end time in seconds, -1 for end (only for repaint mode)',
        },
        seed: {
          type: 'integer',
          description: 'Random seed for reproducibility',
        },
      },
      required: ['caption'],
    },
    enabled: true,
    category: 'media',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const caption = args.caption as string | undefined;
    const lyrics = args.lyrics as string | undefined;
    const duration = (args.duration as number) || 30;
    const bpm = (args.bpm as number) || 120;
    let taskType = (args.task_type as string) || 'text2music';
    const batch = Math.min((args.batch as number) || 1, 4);
    const instrumental = (args.instrumental as boolean) || false;
    const srcAudioPath = args.src_audio_path as string | undefined;
    const strength = args.strength as number | undefined;
    const repaintStart = args.repainting_start as number | undefined;
    const repaintEnd = args.repainting_end as number | undefined;
    const seed = args.seed as number | undefined;

    // Backward compat
    if (taskType === 'caption' || taskType === 'description') {
      taskType = 'text2music';
    }

    if (!caption && !lyrics) {
      return {
        callId,
        content: '',
        error: 'Either "caption" or "lyrics" must be provided',
        success: false,
      };
    }

    if ((taskType === 'remix' || taskType === 'repaint') && !srcAudioPath) {
      return {
        callId,
        content: '',
        error: `"src_audio_path" is required for ${taskType} mode`,
        success: false,
      };
    }

    const baseUrl = await getAceStepUrl();
    const client = new AceStepClient({ baseUrl });

    // Check health
    try {
      await client.health();
    } catch {
      return {
        callId,
        content: '',
        error: `ACE-Step is not running at ${baseUrl}. Please start the service first.`,
        success: false,
      };
    }

    try {
      const result = await client.generateAndWait({
        taskType: taskType as 'text2music' | 'remix' | 'repaint',
        caption: caption || undefined,
        lyrics: lyrics || undefined,
        duration: Math.min(duration, 300),
        bpm,
        batch,
        instrumental: instrumental || undefined,
        srcAudioPath: srcAudioPath || undefined,
        strength,
        repaintStart,
        repaintEnd,
        seed,
      });

      ensureAudioCacheDir();

      const audioUrls: string[] = [];
      for (const audio of result.audios) {
        const filename = generateFilename();
        const filePath = path.join(AUDIO_CACHE_DIR, filename);

        // Download audio from ACE-Step server
        const audioData = await client.downloadAudio(audio.path);
        writeFileSync(filePath, Buffer.from(audioData));

        audioUrls.push(`/api/audio/${filename}`);
      }

      const audioList = audioUrls.map((url) => `- ${url}`).join('\n');
      return {
        callId,
        content:
          `Music generated successfully (mode: ${taskType}).\n` +
          `Audio files:\n${audioList}\n` +
          `Duration: ${duration}s | BPM: ${bpm}` +
          (instrumental ? ' | Instrumental' : ''),
        success: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Music generation failed';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default generateMusicTool;
