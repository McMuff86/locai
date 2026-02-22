# Architecture Design: Audio Services (ACE-Step + Qwen3-TTS)

> **Status:** Implemented  
> **Branch:** `nightly/22-02-audio-services`  
> **Date:** 2026-02-22

---

## Overview

Integrate two local audio generation services into LocAI:

- **ACE-Step** — AI music generation (text/lyrics → audio)
- **Qwen3-TTS** — Text-to-speech with voice cloning, custom speakers, and voice design

Both services run locally and are accessed via npm client packages.

---

## 1. Settings Extension

**File:** `src/hooks/useSettings.ts`

### New Fields in `AppSettings`

```typescript
export interface AppSettings {
  // ... existing fields ...

  // Audio Services
  aceStepUrl: string;
  qwenTTSUrl: string;
}
```

### New Defaults in `DEFAULT_SETTINGS`

```typescript
const DEFAULT_SETTINGS: AppSettings = {
  // ... existing defaults ...

  aceStepUrl: 'http://localhost:8001',
  qwenTTSUrl: 'http://localhost:7861',
};
```

---

## 2. Agent Tools

### 2.1 Tool Names

**File:** `src/lib/agents/tools/names.ts`

```typescript
export const BUILTIN_TOOL_NAMES = [
  // ... existing ...
  'generate_music',
  'text_to_speech',
] as const;
```

### 2.2 `generate_music` Tool

**File:** `src/lib/agents/tools/generateMusic.ts`

#### Tool Definition

```typescript
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
          description: 'Text description of the music to generate (used when taskType is "caption")',
        },
        lyrics: {
          type: 'string',
          description: 'Lyrics to set to music (used when taskType is "description")',
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
  handler: generateMusicHandler,
};
```

#### Handler Flow

```
1. Read aceStepUrl from settings (GET /api/settings)
2. Create AceStepClient({ baseUrl: aceStepUrl })
3. Call client.health() → if fails, return error
4. Call client.generateAndWait(options) → GenerationResult
5. For each audio in result.audios:
   - Proxy audio through /api/audio/[filename]
6. Return success with audio URLs and metadata
```

#### Return Format

```typescript
// Success
{
  callId: string;
  content: `Music generated successfully.\n` +
           `Audio files:\n` +
           `- /api/audio/{filename1}\n` +
           `Duration: {duration}s | BPM: {bpm}`;
  success: true;
}

// Error
{
  callId: string;
  content: '';
  error: 'ACE-Step is not running at {url}. Please start the service first.';
  success: false;
}
```

### 2.3 `text_to_speech` Tool

**File:** `src/lib/agents/tools/textToSpeech.ts`

#### Tool Definition

```typescript
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
  handler: textToSpeechHandler,
};
```

#### Handler Flow

```
1. Read qwenTTSUrl from settings (GET /api/settings)
2. Create QwenTTSClient({ baseUrl: qwenTTSUrl })
3. Call client.isAvailable() → if false, return error
4. Based on mode:
   - "clone"  → client.cloneVoice({ referenceAudio, referenceText, text, language })
   - "custom" → client.customVoice({ text, language, speaker })
   - "design" → client.designVoice({ text, language, voiceDescription })
5. Proxy audio through /api/audio/[filename]
6. Return success with audio URL
```

#### Return Format

```typescript
// Success
{
  callId: string;
  content: `Speech generated successfully.\n` +
           `Audio: /api/audio/{filename}\n` +
           `Duration: {duration}s | Language: {language} | Mode: {mode}`;
  success: true;
}
```

### 2.4 Tool Registration

**File:** `src/lib/agents/tools/index.ts`

```typescript
import generateMusicTool from './generateMusic';
import textToSpeechTool from './textToSpeech';

export const builtinTools = [
  // ... existing ...
  generateMusicTool,
  textToSpeechTool,
] as const;

// Also add to re-exports
export { generateMusicTool, textToSpeechTool };
```

---

## 3. API Routes

### 3.1 ACE-Step Routes

#### `POST /api/ace-step/health`

**File:** `src/app/api/ace-step/health/route.ts`

```typescript
// Request: { url?: string }
// Response: { success: boolean; status: HealthStatus } | { success: false; error: string }

// Flow: Read aceStepUrl from settings (or request body override)
//       → AceStepClient.health()
```

#### `POST /api/ace-step/generate`

**File:** `src/app/api/ace-step/generate/route.ts`

```typescript
// Request: GenerateOptions (caption, lyrics, duration, bpm, taskType, batch)
// Response: { success: true; taskId: string } | { success: false; error: string }

// Flow: Create client → client.generate(options) → return TaskInfo
```

#### `POST /api/ace-step/status/[taskId]`

**File:** `src/app/api/ace-step/status/[taskId]/route.ts`

```typescript
// Request: POST with taskId in URL params
// Response: { success: true; results: TaskResult[] } | { success: false; error: string }

// Flow: Create client → client.getStatus(taskId) → return results
```

### 3.2 Qwen3-TTS Routes

#### `POST /api/qwen-tts/health`

**File:** `src/app/api/qwen-tts/health/route.ts`

```typescript
// Request: { url?: string }
// Response: { success: boolean; available: boolean }

// Flow: Create client → client.isAvailable()
```

#### `POST /api/qwen-tts/generate`

**File:** `src/app/api/qwen-tts/generate/route.ts`

```typescript
// Request:
interface TTSGenerateRequest {
  text: string;
  language: Language;
  mode: 'clone' | 'custom' | 'design';
  // Mode-specific:
  referenceAudio?: string;   // clone
  referenceText?: string;    // clone
  speaker?: Speaker;         // custom
  instructText?: string;     // custom
  voiceDescription?: string; // design
  modelSize?: ModelSize;
}

// Response: { success: true; audioUrl: string; duration: number }
//         | { success: false; error: string }
```

### 3.3 Audio File Serving

#### `GET /api/audio/[filename]`

**File:** `src/app/api/audio/[filename]/route.ts`

```typescript
// Serves generated audio files from a local cache directory (~/.locai/audio/)
// 
// Flow:
// 1. Validate filename (no path traversal)
// 2. Check file exists in audio cache dir
// 3. Return file with Content-Type: audio/wav (or detected mime type)
// 4. Support Range headers for streaming playback
//
// Audio files are downloaded from ACE-Step/Qwen-TTS services
// and cached locally when first requested by tool handlers.

// Cache directory: process.env.LOCAI_AUDIO_DIR || path.join(homedir(), '.locai', 'audio')
```

---

## 4. Frontend Components

### 4.1 `AudioPlayer` Component

**File:** `src/components/AudioPlayer.tsx`

```typescript
interface AudioPlayerProps {
  /** URL to the audio file (e.g., /api/audio/xxx.wav) */
  src: string;
  /** Display title */
  title?: string;
  /** Show download button */
  downloadable?: boolean;
  /** Compact mode for inline chat display */
  compact?: boolean;
}
```

**Features:**
- Play/pause toggle button
- Progress bar (seek-able)
- Current time / total duration display
- Download button (optional)
- Compact variant for chat message embedding
- Uses native `<audio>` element under the hood
- Waveform visualization (optional, future enhancement)

### 4.2 Chat Message Audio Rendering

**File:** Extend `src/components/chat/MessageContent.tsx` (or equivalent)

When a tool result contains audio URLs (pattern: `/api/audio/`), render inline `<AudioPlayer>` components:

```typescript
// Detection: scan tool result content for /api/audio/ URLs
// Render: <AudioPlayer src={url} compact title="Generated Audio" downloadable />
```

### 4.3 Settings Page: Audio Services Section

**File:** `src/app/(app)/settings/page.tsx`

Add new section following existing pattern (between "ComfyUI" and "Notes"):

```tsx
{/* ────────────── Audio Services ────────────── */}
<section className="space-y-4">
  <div className="flex items-center gap-2 text-lg font-semibold">
    <Music className="h-5 w-5 text-primary" />
    Audio Services
  </div>
  <div className="bg-card border border-border rounded-lg p-4 space-y-4">
    {/* ACE-Step URL */}
    <div>
      <label className="block font-medium mb-1">ACE-Step URL</label>
      <p className="text-sm text-muted-foreground mb-2">URL des ACE-Step Musik-Generators</p>
      <Input
        value={settings?.aceStepUrl || 'http://localhost:8001'}
        onChange={(e) => handleInputChange('aceStepUrl', e.target.value)}
        placeholder="http://localhost:8001"
      />
      {/* Health indicator: green dot + "Verbunden" or red dot + "Nicht erreichbar" */}
      <HealthIndicator endpoint="/api/ace-step/health" label="ACE-Step" />
    </div>

    {/* Qwen3-TTS URL */}
    <div>
      <label className="block font-medium mb-1">Qwen3-TTS URL</label>
      <p className="text-sm text-muted-foreground mb-2">URL des Qwen3-TTS Sprachsynthese-Servers</p>
      <Input
        value={settings?.qwenTTSUrl || 'http://localhost:7861'}
        onChange={(e) => handleInputChange('qwenTTSUrl', e.target.value)}
        placeholder="http://localhost:7861"
      />
      <HealthIndicator endpoint="/api/qwen-tts/health" label="Qwen3-TTS" />
    </div>
  </div>
</section>
```

### 4.4 `HealthIndicator` Component

**File:** `src/components/HealthIndicator.tsx`

```typescript
interface HealthIndicatorProps {
  /** API endpoint to poll for health (POST) */
  endpoint: string;
  /** Display label */
  label: string;
  /** Poll interval in ms (default: 15000) */
  pollInterval?: number;
}

// Renders: colored dot (green/red/yellow) + status text
// Polls health endpoint on mount + interval
// States: "Verbunden" | "Nicht erreichbar" | "Prüfe..."
```

---

## 5. npm Dependencies

```json
{
  "dependencies": {
    "@mcmuff86/ace-step-client": "latest",
    "@mcmuff86/qwen3-tts-client": "latest"
  }
}
```

---

## 6. File Structure Summary

```
src/
├── app/
│   ├── api/
│   │   ├── ace-step/
│   │   │   ├── health/route.ts
│   │   │   ├── generate/route.ts
│   │   │   └── status/[taskId]/route.ts
│   │   ├── qwen-tts/
│   │   │   ├── health/route.ts
│   │   │   └── generate/route.ts
│   │   └── audio/
│   │       └── [filename]/route.ts
│   └── (app)/settings/page.tsx          ← extend
├── components/
│   ├── AudioPlayer.tsx                   ← new
│   └── HealthIndicator.tsx               ← new
├── hooks/
│   └── useSettings.ts                    ← extend
└── lib/
    └── agents/
        └── tools/
            ├── generateMusic.ts          ← new
            ├── textToSpeech.ts           ← new
            ├── index.ts                  ← extend
            └── names.ts                  ← extend
```

---

## 7. Data Flow

```
User Message
  → Agent selects generate_music / text_to_speech tool
    → Tool handler reads settings (aceStepUrl / qwenTTSUrl)
      → Creates client instance
        → Calls service API (generate / generateAndWait)
          → Downloads audio to local cache (~/.locai/audio/)
            → Returns /api/audio/{filename} URL in tool result
              → Chat UI detects audio URL → renders <AudioPlayer>
```

---

## 8. Error Handling

| Scenario | Handling |
|---|---|
| Service not running | Tool returns error with setup instructions |
| Generation timeout | AceStepTimeoutError / client timeout → tool error with retry suggestion |
| Invalid parameters | Validate in handler before calling client, return descriptive error |
| Audio download fails | Retry once, then return error |
| File not found (audio serve) | 404 response |
| Path traversal attempt | Reject filenames containing `..` or `/` |
