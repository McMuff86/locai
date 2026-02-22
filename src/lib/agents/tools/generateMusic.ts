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

const AUDIO_CACHE_DIR = path.join(homedir(), '.locai', 'audio');

function ensureAudioCacheDir(): void {
  mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
}

function generateFilename(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}.wav`;
}

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

const generateMusicTool: RegisteredTool = {
  definition: {
    name: 'generate_music',
    description:
      'Generate music using the local ACE-Step AI music generation service. ' +
      'Provide either a caption describing the music or lyrics to set to music. ' +
      'Returns audio file URLs when generation completes.',
    parameters: {
      type: 'object',
      properties: {
        caption: {
          type: 'string',
          description: 'Text description of the music to generate (used when task_type is "caption")',
        },
        lyrics: {
          type: 'string',
          description: 'Lyrics to set to music (used when task_type is "description")',
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
          enum: ['caption', 'description'],
          description: 'Generation mode: "caption" for text prompt, "description" for lyrics-based (default: "caption")',
        },
        batch: {
          type: 'integer',
          description: 'Number of variations to generate (default: 1, max: 4)',
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
    const taskType = (args.task_type as 'caption' | 'description') || 'caption';
    const batch = Math.min((args.batch as number) || 1, 4);

    if (!caption && !lyrics) {
      return {
        callId,
        content: '',
        error: 'Either "caption" or "lyrics" must be provided',
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
        taskType,
        caption: caption || undefined,
        lyrics: lyrics || undefined,
        duration: Math.min(duration, 300),
        bpm,
        batch,
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
          `Music generated successfully.\n` +
          `Audio files:\n${audioList}\n` +
          `Duration: ${duration}s | BPM: ${bpm}`,
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
