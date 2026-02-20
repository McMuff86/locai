import path from 'path';
import { promises as fs } from 'fs';
import {
  isTruthyEnv,
  parseHostnameFromOrigin,
  parseHostnameFromHost,
  isLocalHostname,
  getBearerToken,
  forbidden,
} from '@/lib/security-shared';

/**
 * SEC-2: Validate that a user-supplied path doesn't contain traversal sequences.
 * Resolves to absolute and rejects paths containing '..'.
 * Returns the resolved absolute path on success, or null on traversal attempt.
 */
export function sanitizeBasePath(userPath: string): string | null {
  if (!userPath || typeof userPath !== 'string') return null;
  // Reject any path with '..' components to prevent traversal
  if (userPath.includes('..')) return null;
  return path.resolve(userPath);
}

/**
 * SEC-2: Validate that a resolved path stays within an allowed prefix directory.
 */
export function validatePath(userPath: string, allowedPrefix: string): string | null {
  const resolved = path.resolve(userPath);
  const normalizedPrefix = path.resolve(allowedPrefix);
  if (resolved === normalizedPrefix || resolved.startsWith(normalizedPrefix + path.sep)) {
    return resolved;
  }
  return null;
}

/**
 * Get the base path for a LocAI subdirectory (e.g. 'conversations', 'memory').
 * Creates the directory if it doesn't exist.
 * Returns the absolute path to `~/.locai/{subdir}`.
 */
export async function getLocaiBasePath(subdir?: string): Promise<string> {
  const home = process.env.USERPROFILE || process.env.HOME || '/tmp';
  const base = subdir ? path.join(home, '.locai', subdir) : path.join(home, '.locai');
  await fs.mkdir(base, { recursive: true });
  return base;
}

// ── SSRF Protection ─────────────────────────────────────────────────

/**
 * Private/reserved IPv4 ranges that must not be reached via user-supplied URLs.
 * Localhost (127.x) is intentionally allowed — Ollama and ComfyUI run there.
 */
const PRIVATE_IP_PATTERNS = [
  /^10\./,                   // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,             // 192.168.0.0/16
  /^169\.254\./,             // link-local
  /^0\./,                    // 0.0.0.0/8
];

function isPrivateIp(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((re) => re.test(hostname));
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export type UrlValidationResult =
  | { valid: true; url: string }
  | { valid: false; reason: string };

/**
 * Validate a user-supplied URL for server-side fetch to prevent SSRF.
 *
 * Rules:
 *  - Only http/https protocols
 *  - Blocks private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x, 0.x)
 *  - Allows localhost / 127.0.0.1 / ::1 (local services like Ollama)
 *  - Blocks file://, gopher://, data:, etc.
 */
export function validateServiceUrl(
  raw: string | undefined | null,
  options?: { allowLocalhost?: boolean; label?: string },
): UrlValidationResult {
  const allowLocalhost = options?.allowLocalhost ?? true;
  const label = options?.label ?? 'URL';

  if (!raw || typeof raw !== 'string') {
    return { valid: false, reason: `${label} is required` };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, reason: `${label} is empty` };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: `${label} is not a valid URL` };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { valid: false, reason: `${label}: protocol "${parsed.protocol}" is not allowed` };
  }

  const hostname = parsed.hostname;

  // Allow localhost when requested (default)
  if (isLocalHostname(hostname) || hostname === '127.0.0.1') {
    if (!allowLocalhost) {
      return { valid: false, reason: `${label}: localhost is not allowed` };
    }
    return { valid: true, url: trimmed.replace(/\/+$/, '') };
  }

  // Block private IP ranges
  if (isPrivateIp(hostname)) {
    return { valid: false, reason: `${label}: private IP addresses are not allowed` };
  }

  return { valid: true, url: trimmed.replace(/\/+$/, '') };
}

/** Validate a URL intended for an Ollama host (must be http(s), allows localhost). */
export function validateOllamaHost(raw: string | undefined | null): UrlValidationResult {
  return validateServiceUrl(raw, { allowLocalhost: true, label: 'Ollama host' });
}

/** Validate a URL intended for a SearXNG instance. */
export function validateSearxngUrl(raw: string | undefined | null): UrlValidationResult {
  return validateServiceUrl(raw, { allowLocalhost: true, label: 'SearXNG URL' });
}

/** Validate an arbitrary external URL (e.g. page content fetch). */
export function validateExternalUrl(raw: string | undefined | null): UrlValidationResult {
  return validateServiceUrl(raw, { allowLocalhost: false, label: 'External URL' });
}

/**
 * Construct and validate a ComfyUI URL from separate host + port params.
 * This is the most dangerous SSRF vector because the URL is assembled from parts.
 */
export function validateComfyuiUrl(
  host: string | undefined | null,
  port: string | number | undefined | null,
): UrlValidationResult {
  const h = (host || 'localhost').trim();
  const p = Number(port) || 8188;

  if (p < 1 || p > 65535 || !Number.isInteger(p)) {
    return { valid: false, reason: 'ComfyUI port must be 1-65535' };
  }

  // Reject shell metacharacters in host (extra paranoia)
  if (/[;&|`$(){}!#]/.test(h)) {
    return { valid: false, reason: 'ComfyUI host contains invalid characters' };
  }

  const url = `http://${h}:${p}`;
  return validateServiceUrl(url, { allowLocalhost: true, label: 'ComfyUI URL' });
}

export function assertLocalRequest(request: Request) {
  const requiredToken = process.env.LOCAI_API_TOKEN?.trim();
  if (requiredToken) {
    const tokenHeader = request.headers.get('x-locai-token')?.trim();
    const bearer = getBearerToken(request.headers.get('authorization'));
    if (tokenHeader !== requiredToken && bearer !== requiredToken) {
      return forbidden('Missing or invalid API token');
    }
  }

  if (isTruthyEnv(process.env.LOCAI_ALLOW_REMOTE)) return null;

  const originHostname = parseHostnameFromOrigin(request.headers.get('origin'));
  const hostHostname = parseHostnameFromHost(request.headers.get('host'));

  if (originHostname && !isLocalHostname(originHostname)) {
    return forbidden('Remote requests are not allowed', { reason: 'origin_not_local' });
  }
  if (hostHostname && !isLocalHostname(hostHostname)) {
    return forbidden('Remote requests are not allowed', { reason: 'host_not_local' });
  }

  if (originHostname || hostHostname) return null;
  return forbidden('Remote requests are not allowed', { reason: 'missing_origin_and_host' });
}

