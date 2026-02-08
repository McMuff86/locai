import { describe, it, expect, afterEach } from 'vitest';
import { sanitizeBasePath, validatePath, assertLocalRequest } from './security';
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
    // "/tmp/testXXX" starts with "/tmp/test" but is a sibling, not a child
    expect(validatePath('/tmp/testXXX', prefix)).toBeNull();
  });
});

// ── assertLocalRequest ──────────────────────────────────────────────

describe('assertLocalRequest', () => {
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

  function makeRequest(url: string, headers: Record<string, string> = {}) {
    return new Request(url, { headers });
  }

  // ── local origins ──

  it('accepts request with localhost origin', () => {
    const req = makeRequest('http://localhost/api/test', {
      origin: 'http://localhost:3000',
    });
    const res = assertLocalRequest(req);
    expect(res).toBeNull();
  });

  it('accepts request with 127.0.0.1 host', () => {
    const req = makeRequest('http://127.0.0.1/api/test', {
      host: '127.0.0.1:3000',
    });
    const res = assertLocalRequest(req);
    expect(res).toBeNull();
  });

  it('accepts request with ::1 host', () => {
    const req = makeRequest('http://[::1]/api/test', {
      host: '[::1]:3000',
    });
    const res = assertLocalRequest(req);
    expect(res).toBeNull();
  });

  // ── remote origin ──

  it('rejects request from remote origin', async () => {
    const req = makeRequest('http://example.com/api/test', {
      origin: 'http://example.com',
    });
    const res = assertLocalRequest(req);
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.success).toBe(false);
    expect(res!.status).toBe(403);
  });

  // ── token auth ──

  it('accepts request with correct LOCAI_API_TOKEN', () => {
    saveEnv('LOCAI_API_TOKEN');
    process.env.LOCAI_API_TOKEN = 'secret-token-123';

    const req = makeRequest('http://localhost/api/test', {
      'x-locai-token': 'secret-token-123',
      origin: 'http://localhost',
    });
    const res = assertLocalRequest(req);
    expect(res).toBeNull();
  });

  it('rejects request with wrong LOCAI_API_TOKEN', async () => {
    saveEnv('LOCAI_API_TOKEN');
    process.env.LOCAI_API_TOKEN = 'secret-token-123';

    const req = makeRequest('http://localhost/api/test', {
      'x-locai-token': 'wrong-token',
      origin: 'http://localhost',
    });
    const res = assertLocalRequest(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  // ── LOCAI_ALLOW_REMOTE ──

  it('accepts any origin when LOCAI_ALLOW_REMOTE=true', () => {
    saveEnv('LOCAI_ALLOW_REMOTE');
    process.env.LOCAI_ALLOW_REMOTE = 'true';

    const req = makeRequest('http://evil.example.com/api/test', {
      origin: 'http://evil.example.com',
    });
    const res = assertLocalRequest(req);
    expect(res).toBeNull();
  });
});
