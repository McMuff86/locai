import { describe, it, expect, afterEach } from 'vitest';
import {
  sanitizeBasePath,
  validatePath,
  validateServiceUrl,
  validateOllamaHost,
  validateSearxngUrl,
  validateExternalUrl,
  validateComfyuiUrl,
} from './security';
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

// ── SSRF: validateServiceUrl ─────────────────────────────────────────

describe('validateServiceUrl', () => {
  // ── Blocked protocols ──
  it('blocks file:// protocol', () => {
    const r = validateServiceUrl('file:///etc/passwd');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain('protocol');
  });

  it('blocks gopher:// protocol', () => {
    const r = validateServiceUrl('gopher://localhost/');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain('protocol');
  });

  it('blocks data: protocol', () => {
    const r = validateServiceUrl('data:text/html,<h1>hi</h1>');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain('protocol');
  });

  // ── Blocked private IPs ──
  it('blocks 10.x.x.x', () => {
    const r = validateServiceUrl('http://10.0.0.1:8080/');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain('private');
  });

  it('blocks 192.168.x.x', () => {
    const r = validateServiceUrl('http://192.168.1.1/');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain('private');
  });

  it('blocks 172.16.x.x', () => {
    const r = validateServiceUrl('http://172.16.0.1/');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain('private');
  });

  it('blocks 169.254.x.x (link-local)', () => {
    const r = validateServiceUrl('http://169.254.169.254/latest/meta-data/');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain('private');
  });

  // ── Allowed localhost ──
  it('allows http://localhost:11434', () => {
    const r = validateServiceUrl('http://localhost:11434/');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.url).toBe('http://localhost:11434');
  });

  it('allows http://127.0.0.1:11434', () => {
    const r = validateServiceUrl('http://127.0.0.1:11434/');
    expect(r.valid).toBe(true);
  });

  // ── Localhost blocked when allowLocalhost=false ──
  it('blocks localhost when allowLocalhost=false', () => {
    const r = validateServiceUrl('http://localhost:11434', { allowLocalhost: false });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain('localhost');
  });

  // ── External URLs ──
  it('allows normal external URLs', () => {
    const r = validateServiceUrl('https://example.com/api');
    expect(r.valid).toBe(true);
  });

  // ── Edge cases ──
  it('returns invalid for empty string', () => {
    const r = validateServiceUrl('');
    expect(r.valid).toBe(false);
  });

  it('returns invalid for null/undefined', () => {
    expect(validateServiceUrl(null).valid).toBe(false);
    expect(validateServiceUrl(undefined).valid).toBe(false);
  });

  it('returns invalid for non-URL strings', () => {
    expect(validateServiceUrl('not-a-url').valid).toBe(false);
  });

  it('strips trailing slashes', () => {
    const r = validateServiceUrl('http://localhost:11434///');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.url).toBe('http://localhost:11434');
  });
});

// ── SSRF: convenience wrappers ──────────────────────────────────────

describe('validateOllamaHost', () => {
  it('allows default Ollama host', () => {
    const r = validateOllamaHost('http://localhost:11434');
    expect(r.valid).toBe(true);
  });

  it('blocks private IP', () => {
    expect(validateOllamaHost('http://10.0.0.5:11434').valid).toBe(false);
  });
});

describe('validateSearxngUrl', () => {
  it('allows localhost SearXNG', () => {
    const r = validateSearxngUrl('http://localhost:8080');
    expect(r.valid).toBe(true);
  });
});

describe('validateExternalUrl', () => {
  it('blocks localhost (external URLs should not target local services)', () => {
    expect(validateExternalUrl('http://localhost:3000').valid).toBe(false);
  });

  it('allows external HTTPS URLs', () => {
    expect(validateExternalUrl('https://example.com/page').valid).toBe(true);
  });
});

describe('validateComfyuiUrl', () => {
  it('allows default localhost:8188', () => {
    const r = validateComfyuiUrl('localhost', '8188');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.url).toBe('http://localhost:8188');
  });

  it('rejects port out of range', () => {
    expect(validateComfyuiUrl('localhost', '99999').valid).toBe(false);
  });

  it('rejects shell metacharacters in host', () => {
    expect(validateComfyuiUrl('localhost;rm -rf /', '8188').valid).toBe(false);
  });

  it('rejects private IP hosts', () => {
    expect(validateComfyuiUrl('10.0.0.1', '8188').valid).toBe(false);
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
