import { describe, it, expect, afterEach } from 'vitest';
import { sanitizeBasePath, validatePath } from './security';
import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';
import path from 'path';

// ── sanitizeBasePath ────────────────────────────────────────────────

describe('sanitizeBasePath', () => {
  it('returns null for empty string', () => {
    expect(sanitizeBasePath('')).toBeNull();
  });

  it('returns null when path contains ".."', () => {
    expect(sanitizeBasePath('/tmp/foo/../etc/passwd')).toBeNull();
    expect(sanitizeBasePath('..')).toBeNull();
    expect(sanitizeBasePath('foo/../../bar')).toBeNull();
  });

  it('returns resolved absolute path for normal input', () => {
    const result = sanitizeBasePath('/tmp/mydir');
    expect(result).toBe(path.resolve('/tmp/mydir'));
  });

  it('returns null for non-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeBasePath(undefined as any)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeBasePath(null as any)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeBasePath(123 as any)).toBeNull();
  });
});

// ── validatePath ────────────────────────────────────────────────────

describe('validatePath', () => {
  const prefix = '/tmp/test';

  it('accepts a path inside the prefix directory', () => {
    expect(validatePath('/tmp/test/sub/file.txt', prefix)).toBe(
      path.resolve('/tmp/test/sub/file.txt'),
    );
  });

  it('accepts a path that equals the prefix exactly', () => {
    expect(validatePath('/tmp/test', prefix)).toBe(path.resolve('/tmp/test'));
  });

  it('rejects a path outside the prefix', () => {
    expect(validatePath('/etc/passwd', prefix)).toBeNull();
  });

  it('rejects a path that starts with the prefix string but is not a subdirectory', () => {
    expect(validatePath('/tmp/testXXX', prefix)).toBeNull();
  });
});

// ── middleware ───────────────────────────────────────────────────────

describe('middleware', () => {
  const savedEnv: Record<string, string | undefined> = {};

  function saveEnv(...keys: string[]) {
    for (const k of keys) savedEnv[k] = process.env[k];
  }

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function makeRequest(
    url: string,
    headers: Record<string, string> = {},
    method = 'GET',
  ) {
    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers,
    });
  }

  // ── health check bypass ──

  it('allows GET /api/health without auth', () => {
    saveEnv('LOCAI_API_TOKEN');
    process.env.LOCAI_API_TOKEN = 'secret';
    const req = makeRequest('/api/health', {}, 'GET');
    const res = middleware(req);
    expect(res.status).not.toBe(403);
  });

  it('enforces auth on POST /api/health', async () => {
    saveEnv('LOCAI_API_TOKEN');
    process.env.LOCAI_API_TOKEN = 'secret';
    const req = makeRequest('/api/health', { host: 'localhost:3000' }, 'POST');
    const res = middleware(req);
    expect(res.status).toBe(403);
  });

  // ── local origins ──

  it('accepts request with localhost origin', () => {
    const req = makeRequest('/api/test', {
      origin: 'http://localhost:3000',
    });
    const res = middleware(req);
    expect(res.status).not.toBe(403);
  });

  it('accepts request with 127.0.0.1 host', () => {
    const req = makeRequest('/api/test', {
      host: '127.0.0.1:3000',
    });
    const res = middleware(req);
    expect(res.status).not.toBe(403);
  });

  it('accepts request with ::1 host', () => {
    const req = makeRequest('/api/test', {
      host: '[::1]:3000',
    });
    const res = middleware(req);
    expect(res.status).not.toBe(403);
  });

  // ── remote origin ──

  it('rejects request from remote origin', async () => {
    const req = makeRequest('/api/test', {
      origin: 'http://example.com',
    });
    const res = middleware(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // ── token auth ──

  it('accepts request with correct LOCAI_API_TOKEN via x-locai-token', () => {
    saveEnv('LOCAI_API_TOKEN');
    process.env.LOCAI_API_TOKEN = 'secret-token-123';

    const req = makeRequest('/api/test', {
      'x-locai-token': 'secret-token-123',
      origin: 'http://localhost',
    });
    const res = middleware(req);
    expect(res.status).not.toBe(403);
  });

  it('accepts request with correct LOCAI_API_TOKEN via Bearer', () => {
    saveEnv('LOCAI_API_TOKEN');
    process.env.LOCAI_API_TOKEN = 'secret-token-123';

    const req = makeRequest('/api/test', {
      authorization: 'Bearer secret-token-123',
      origin: 'http://localhost',
    });
    const res = middleware(req);
    expect(res.status).not.toBe(403);
  });

  it('rejects request with wrong LOCAI_API_TOKEN', async () => {
    saveEnv('LOCAI_API_TOKEN');
    process.env.LOCAI_API_TOKEN = 'secret-token-123';

    const req = makeRequest('/api/test', {
      'x-locai-token': 'wrong-token',
      origin: 'http://localhost',
    });
    const res = middleware(req);
    expect(res.status).toBe(403);
  });

  // ── LOCAI_ALLOW_REMOTE ──

  it('accepts any origin when LOCAI_ALLOW_REMOTE=true', () => {
    saveEnv('LOCAI_ALLOW_REMOTE');
    process.env.LOCAI_ALLOW_REMOTE = 'true';

    const req = makeRequest('/api/test', {
      origin: 'http://evil.example.com',
    });
    const res = middleware(req);
    expect(res.status).not.toBe(403);
  });

  // ── missing headers ──

  it('rejects request with no origin or host headers', async () => {
    const req = makeRequest('/api/test', {});
    const res = middleware(req);
    expect(res.status).toBe(403);
  });
});
