// ============================================================================
// Built-in Tool: text_to_speech
// ============================================================================
// Converts text to speech using the local Qwen3-TTS service.
// Supports voice cloning, custom speakers, and voice design.
// ============================================================================

import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { QwenTTSClient } from '../../qwenTTS';
import type { Language, Speaker } from '../../qwenTTS';
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

/** Retrieves the Qwen3-TTS service URL from app settings, falling back to localhost:7861. */
async function getQwenTTSUrl(): Promise<string> {
  try {
    const res = await fetch('http://localhost:3000/api/settings');
    const data = await res.json();
    if (data.success && data.settings?.qwenTTSUrl) {
      return data.settings.qwenTTSUrl;
    }
  } catch {
    // Fall through to default
  }
  return 'http://localhost:7861';
}

/**
 * Agent tool for text-to-speech via the local Qwen3-TTS service.
 * Supports three modes: voice cloning from reference audio, custom predefined speakers, and voice design from description.
 */
const textToSpeechTool: RegisteredTool = {
  definition: {
    name: 'text_to_speech',
    description:
      'Convert text to speech using the local Qwen3-TTS service. ' +
      'Supports three modes: voice cloning from reference audio, ' +
      'custom voice with predefined speakers, and voice design from description.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to convert to speech',
        },
        language: {
          type: 'string',
          enum: ['German', 'English', 'French', 'Spanish', 'Italian',
                 'Portuguese', 'Russian', 'Japanese', 'Korean', 'Chinese'],
          description: 'Language for speech generation (default: "German")',
        },
        mode: {
          type: 'string',
          enum: ['clone', 'custom', 'design'],
          description: 'Voice mode: "clone" uses reference audio, "custom" uses predefined speaker, "design" uses voice description (default: "custom")',
        },
        reference_audio: {
          type: 'string',
          description: 'Path to reference audio file (required for mode "clone")',
        },
        reference_text: {
          type: 'string',
          description: 'Transcript of the reference audio (required for mode "clone")',
        },
        speaker: {
          type: 'string',
          enum: ['Ryan', 'Aiden', 'Vivian', 'Serena', 'Uncle_Fu',
                 'Dylan', 'Eric', 'Ono_Anna', 'Sohee'],
          description: 'Predefined speaker name (for mode "custom", default: "Vivian")',
        },
        voice_description: {
          type: 'string',
          description: 'Natural language description of desired voice (required for mode "design")',
        },
      },
      required: ['text'],
    },
    enabled: true,
    category: 'media',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const text = args.text as string | undefined;
    const language = (args.language as Language) || 'German';
    const mode = (args.mode as 'clone' | 'custom' | 'design') || 'custom';
    const referenceAudio = args.reference_audio as string | undefined;
    const referenceText = args.reference_text as string | undefined;
    const speaker = (args.speaker as Speaker) || 'Vivian';
    const voiceDescription = args.voice_description as string | undefined;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return {
        callId,
        content: '',
        error: 'Parameter "text" is required and must be a non-empty string',
        success: false,
      };
    }

    if (mode === 'clone' && (!referenceAudio || !referenceText)) {
      return {
        callId,
        content: '',
        error: 'Mode "clone" requires both "reference_audio" and "reference_text" parameters',
        success: false,
      };
    }

    if (mode === 'design' && !voiceDescription) {
      return {
        callId,
        content: '',
        error: 'Mode "design" requires the "voice_description" parameter',
        success: false,
      };
    }

    const baseUrl = await getQwenTTSUrl();
    const client = new QwenTTSClient({ baseUrl });

    // Check availability
    const available = await client.isAvailable();
    if (!available) {
      return {
        callId,
        content: '',
        error: `Qwen3-TTS is not running at ${baseUrl}. Please start the service first.`,
        success: false,
      };
    }

    try {
      let result;
      switch (mode) {
        case 'clone':
          result = await client.cloneVoice({
            referenceAudio: referenceAudio!,
            referenceText: referenceText!,
            text,
            language,
          });
          break;
        case 'design':
          result = await client.designVoice({
            text,
            language,
            voiceDescription: voiceDescription!,
          });
          break;
        case 'custom':
        default:
          result = await client.customVoice({
            text,
            language,
            speaker,
          });
          break;
      }

      // Download and cache audio
      ensureAudioCacheDir();
      const filename = generateFilename();
      const filePath = path.join(AUDIO_CACHE_DIR, filename);
      const audioData = await client.downloadAudio(result.audioUrl);
      writeFileSync(filePath, Buffer.from(audioData));

      const audioUrl = `/api/audio/${filename}`;
      return {
        callId,
        content:
          `Speech generated successfully.\n` +
          `Audio: ${audioUrl}\n` +
          `Duration: ${result.duration.toFixed(1)}s | Language: ${language} | Mode: ${mode}`,
        success: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Text-to-speech generation failed';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default textToSpeechTool;
