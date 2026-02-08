import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

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

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function parseHostnameFromOrigin(originHeader: string | null) {
  if (!originHeader || originHeader === 'null') return null;
  try {
    return new URL(originHeader).hostname;
  } catch {
    return null;
  }
}

function parseHostnameFromHost(hostHeader: string | null) {
  if (!hostHeader) return null;
  const trimmed = hostHeader.trim();
  if (trimmed.startsWith('[')) {
    const endBracket = trimmed.indexOf(']');
    if (endBracket > 1) return trimmed.slice(1, endBracket);
    return null;
  }
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) return trimmed;
  return trimmed.slice(0, colonIndex);
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function forbidden(error: string, details?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...details }, { status: 403 });
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

