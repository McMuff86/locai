import { NextResponse } from 'next/server';

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

