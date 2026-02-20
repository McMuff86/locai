import { NextResponse, NextRequest } from 'next/server';
import {
  isTruthyEnv,
  parseHostnameFromOrigin,
  parseHostnameFromHost,
  isLocalHostname,
  getBearerToken,
  forbidden,
} from '@/lib/security-shared';

/**
 * SEC-1: Middleware that enforces local-only access for all API routes.
 * This mirrors the logic from assertLocalRequest() but works at the middleware level
 * to protect ALL /api/* routes uniformly.
 */

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
