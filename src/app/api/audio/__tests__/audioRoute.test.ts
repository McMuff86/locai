import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs before importing route
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    createReadStream: vi.fn(),
  };
});

import { existsSync, statSync, createReadStream } from 'fs';
import { GET } from '../[filename]/route';

const mockExistsSync = vi.mocked(existsSync);
const mockStatSync = vi.mocked(statSync);
const mockCreateReadStream = vi.mocked(createReadStream);

function makeRequest(url = 'http://localhost:3000/api/audio/test.wav'): Request {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/audio/[filename]', () => {
  it('blocks path traversal with ../', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ filename: '../etc/passwd' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });

  it('blocks encoded path traversal ..%2F', async () => {
    // The framework decodes %2F to / before passing as param
    const res = await GET(makeRequest(), { params: Promise.resolve({ filename: '..%2Fetc%2Fpasswd' }) });
    expect(res.status).toBe(400);
  });

  it('blocks backslash traversal', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ filename: '..\\etc\\passwd' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent file', async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await GET(makeRequest(), { params: Promise.resolve({ filename: 'missing.wav' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('returns 200 with audio content-type for valid file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 1024 } as any);

    // Fake readable stream
    const fakeStream = {
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        if (event === 'data') setTimeout(() => cb(Buffer.from('audio-data')), 0);
        if (event === 'end') setTimeout(() => cb(), 5);
        return fakeStream;
      }),
    } as any;
    mockCreateReadStream.mockReturnValue(fakeStream);

    const res = await GET(makeRequest(), { params: Promise.resolve({ filename: '12345-abc.wav' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/wav');
    expect(res.headers.get('Content-Length')).toBe('1024');
  });
});
