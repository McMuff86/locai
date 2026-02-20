/**
 * Shared security helpers used by both middleware.ts (Edge Runtime)
 * and src/app/api/_utils/security.ts (Node Runtime).
 *
 * IMPORTANT: Only Edge-compatible code here — no fs, path, crypto, child_process.
 */

import { NextResponse } from 'next/server';

/** Check if an env value is truthy ("1", "true", "yes"). */
export function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

/** Extract hostname from an Origin header value. */
export function parseHostnameFromOrigin(originHeader: string | null): string | null {
  if (!originHeader || originHeader === 'null') return null;
  try {
    return new URL(originHeader).hostname;
  } catch {
    return null;
  }
}

/** Extract hostname from a Host header value (handles IPv6 brackets). */
export function parseHostnameFromHost(hostHeader: string | null): string | null {
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

/** Return true when the hostname is a loopback address. */
export function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/** Extract a Bearer token from an Authorization header. */
export function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/** Return a 403 JSON response. */
export function forbidden(error: string, details?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...details }, { status: 403 });
}
