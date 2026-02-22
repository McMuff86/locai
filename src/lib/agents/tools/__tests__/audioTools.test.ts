import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing tools
// ---------------------------------------------------------------------------

const mockHealth = vi.fn();
const mockGenerateAndWait = vi.fn();
const mockDownloadAudio = vi.fn();

vi.mock('../../../aceStep', () => ({
  AceStepClient: vi.fn().mockImplementation(() => ({
    health: mockHealth,
    generateAndWait: mockGenerateAndWait,
    downloadAudio: mockDownloadAudio,
  })),
}));

const mockIsAvailable = vi.fn();
const mockCustomVoice = vi.fn();
const mockCloneVoice = vi.fn();
const mockDesignVoice = vi.fn();
const mockDownloadTTSAudio = vi.fn();

vi.mock('../../../qwenTTS', () => ({
  QwenTTSClient: vi.fn().mockImplementation(() => ({
    isAvailable: mockIsAvailable,
    customVoice: mockCustomVoice,
    cloneVoice: mockCloneVoice,
    designVoice: mockDesignVoice,
    downloadAudio: mockDownloadTTSAudio,
  })),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// Mock global fetch for settings API
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import generateMusicTool from '../generateMusic';
import textToSpeechTool from '../textToSpeech';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function settingsResponse(overrides: Record<string, string> = {}) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      settings: { aceStepUrl: 'http://ace:8001', qwenTTSUrl: 'http://qwen:7861', ...overrides },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockImplementation(() => settingsResponse());
});

// ===========================================================================
// generate_music
// ===========================================================================

describe('generate_music', () => {
  const handler = generateMusicTool.handler;

  it('returns error when caption is missing', async () => {
    const result = await handler({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('caption');
  });

  it('returns error when ACE-Step is not reachable', async () => {
    mockHealth.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await handler({ caption: 'lofi beats' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ACE-Step is not running');
  });

  it('returns audio URLs on success', async () => {
    mockHealth.mockResolvedValueOnce({ status: 'ok' });
    mockGenerateAndWait.mockResolvedValueOnce({
      audios: [{ path: '/output/0.wav' }, { path: '/output/1.wav' }],
    });
    mockDownloadAudio.mockResolvedValue(new ArrayBuffer(100));

    const result = await handler({ caption: 'lofi beats', batch: 2 });
    expect(result.success).toBe(true);
    expect(result.content).toContain('/api/audio/');
    // Two URLs
    const urls = result.content!.match(/\/api\/audio\//g);
    expect(urls).toHaveLength(2);
  });

  it('applies default duration and BPM', async () => {
    mockHealth.mockResolvedValueOnce({ status: 'ok' });
    mockGenerateAndWait.mockResolvedValueOnce({ audios: [{ path: '/out/0.wav' }] });
    mockDownloadAudio.mockResolvedValue(new ArrayBuffer(10));

    const result = await handler({ caption: 'test' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Duration: 30s');
    expect(result.content).toContain('BPM: 120');

    expect(mockGenerateAndWait).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 30, bpm: 120 }),
    );
  });
});

// ===========================================================================
// text_to_speech
// ===========================================================================

describe('text_to_speech', () => {
  const handler = textToSpeechTool.handler;

  it('returns error when text is missing', async () => {
    const result = await handler({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('text');
  });

  it('returns error when text is empty string', async () => {
    const result = await handler({ text: '   ' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('text');
  });

  it('returns error for clone mode without reference_audio', async () => {
    const result = await handler({ text: 'hello', mode: 'clone' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('clone');
    expect(result.error).toContain('reference_audio');
  });

  it('returns error for design mode without voice_description', async () => {
    const result = await handler({ text: 'hello', mode: 'design' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('design');
    expect(result.error).toContain('voice_description');
  });

  it('returns error when Qwen3-TTS is not reachable', async () => {
    mockIsAvailable.mockResolvedValueOnce(false);

    const result = await handler({ text: 'hello world' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Qwen3-TTS is not running');
  });

  it('returns audio URL on successful generation', async () => {
    mockIsAvailable.mockResolvedValueOnce(true);
    mockCustomVoice.mockResolvedValueOnce({ audioUrl: '/file/out.wav', duration: 2.5 });
    mockDownloadTTSAudio.mockResolvedValue(new ArrayBuffer(50));

    const result = await handler({ text: 'Hallo Welt' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('/api/audio/');
    expect(result.content).toContain('2.5s');
    expect(result.content).toContain('German');
  });
});
