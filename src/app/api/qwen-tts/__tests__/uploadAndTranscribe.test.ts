import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs before importing routes
vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock security utils
vi.mock('../../_utils/security', () => ({
  assertLocalRequest: vi.fn(() => null),
  validatePath: vi.fn((p: string, _prefix: string) => {
    if (p.includes('..')) return null;
    return p;
  }),
}));

// Mock responses
vi.mock('../../_utils/responses', () => ({
  apiError: (message: string, status: number) =>
    new Response(JSON.stringify({ success: false, error: message }), { status }),
  apiSuccess: (data: Record<string, unknown>) =>
    new Response(JSON.stringify({ success: true, ...data }), { status: 200 }),
}));

// Mock QwenTTSClient
vi.mock('@/lib/qwenTTS', () => ({
  QwenTTSClient: vi.fn().mockImplementation(() => ({
    transcribe: vi.fn().mockResolvedValue({ text: 'hello world' }),
  })),
}));

// Mock fetch for settings lookup in transcribe route
const mockFetch = vi.fn().mockRejectedValue(new Error('no settings'));
vi.stubGlobal('fetch', mockFetch);

import { POST as uploadPOST } from '../upload/route';
import { POST as transcribePOST } from '../transcribe/route';

function makeRequest(body?: BodyInit, headers?: Record<string, string>) {
  return new Request('http://localhost:3000/api/qwen-tts/upload', {
    method: 'POST',
    body,
    headers: { host: 'localhost:3000', ...headers },
  });
}

function makeJsonRequest(body: unknown) {
  return new Request('http://localhost:3000/api/qwen-tts/transcribe', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', host: 'localhost:3000' },
  });
}

describe('qwen-tts upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when no file provided', async () => {
    const formData = new FormData();
    const res = await uploadPOST(makeRequest(formData));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/no audio file/i);
  });

  it('returns error for unsupported MIME type', async () => {
    const formData = new FormData();
    const blob = new Blob(['data'], { type: 'text/plain' });
    formData.append('file', blob, 'test.txt');
    const res = await uploadPOST(makeRequest(formData));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/unsupported file type/i);
  });

  it('returns error when file is too large', async () => {
    const formData = new FormData();
    // Create a blob that reports > 50MB
    const bigBuffer = new ArrayBuffer(51 * 1024 * 1024);
    const blob = new Blob([bigBuffer], { type: 'audio/wav' });
    formData.append('file', blob, 'big.wav');
    const res = await uploadPOST(makeRequest(formData));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/file too large/i);
  });

  it('succeeds with valid audio file', async () => {
    const formData = new FormData();
    const blob = new Blob([new ArrayBuffer(1024)], { type: 'audio/wav' });
    formData.append('file', blob, 'test.wav');
    const res = await uploadPOST(makeRequest(formData));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.filePath).toMatch(/\.wav$/);
  });
});

describe('qwen-tts transcribe route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when filePath is missing', async () => {
    const res = await transcribePOST(makeJsonRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/filePath.*required/i);
  });

  it('returns error for path traversal attempt', async () => {
    const res = await transcribePOST(makeJsonRequest({ filePath: '../../etc/passwd' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid file path/i);
  });

  it('succeeds with valid filePath', async () => {
    const res = await transcribePOST(
      makeJsonRequest({ filePath: '/home/user/.locai/audio/references/ref-123.wav' }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.text).toBe('hello world');
  });
});
