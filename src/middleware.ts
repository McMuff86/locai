import { NextResponse, NextRequest } from 'next/server';

/**
 * SEC-1: Middleware that enforces local-only access for all API routes.
 * This mirrors the logic from assertLocalRequest() but works at the middleware level
 * to protect ALL /api/* routes uniformly.
 */

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

export function middleware(request: NextRequest) {
  // Allow health check without auth
  if (request.nextUrl.pathname === '/api/health' && request.method === 'GET') {
    return NextResponse.next();
  }

  // --- Token-based auth ---
  const requiredToken = process.env.LOCAI_API_TOKEN?.trim();
  if (requiredToken) {
    const tokenHeader = request.headers.get('x-locai-token')?.trim();
    const bearer = getBearerToken(request.headers.get('authorization'));
    if (tokenHeader !== requiredToken && bearer !== requiredToken) {
      return forbidden('Missing or invalid API token');
    }
  }

  // --- Allow remote if explicitly configured ---
  if (isTruthyEnv(process.env.LOCAI_ALLOW_REMOTE)) {
    return NextResponse.next();
  }

  // --- Enforce local-only ---
  const originHostname = parseHostnameFromOrigin(request.headers.get('origin'));
  const hostHostname = parseHostnameFromHost(request.headers.get('host'));

  if (originHostname && !isLocalHostname(originHostname)) {
    return forbidden('Remote requests are not allowed', { reason: 'origin_not_local' });
  }
  if (hostHostname && !isLocalHostname(hostHostname)) {
    return forbidden('Remote requests are not allowed', { reason: 'host_not_local' });
  }

  if (originHostname || hostHostname) {
    return NextResponse.next();
  }

  return forbidden('Remote requests are not allowed', { reason: 'missing_origin_and_host' });
}

// Only apply to API routes
export const config = {
  matcher: '/api/:path*',
};
