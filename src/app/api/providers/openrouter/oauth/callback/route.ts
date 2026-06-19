import { NextRequest, NextResponse } from 'next/server';
import { writeStoredProviderCredential } from '@/lib/providers/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'locai_openrouter_oauth';

interface OAuthCookiePayload {
  state: string;
  codeVerifier: string;
}

interface OpenRouterKeyResponse {
  key?: string;
  error?: string;
}

function decodeCookie(value: string | undefined): OAuthCookiePayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf-8')) as OAuthCookiePayload;
    if (!parsed.state || !parsed.codeVerifier) return null;
    return parsed;
  } catch {
    return null;
  }
}

function redirectToSettings(request: NextRequest, status: 'connected' | 'error', message?: string): NextResponse {
  const url = new URL('/settings', request.nextUrl.origin);
  url.searchParams.set('provider', 'openrouter');
  url.searchParams.set('oauth', status);
  if (message) url.searchParams.set('message', message.slice(0, 160));
  const response = NextResponse.redirect(url);
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookie = decodeCookie(request.cookies.get(COOKIE_NAME)?.value);

  if (!code || !state || !cookie || state !== cookie.state) {
    return redirectToSettings(request, 'error', 'OpenRouter OAuth state validation failed');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: cookie.codeVerifier,
        code_challenge_method: 'S256',
      }),
    });

    const data = (await response.json().catch(() => ({}))) as OpenRouterKeyResponse;
    if (!response.ok || !data.key) {
      return redirectToSettings(
        request,
        'error',
        data.error || `OpenRouter OAuth exchange failed (${response.status})`,
      );
    }

    writeStoredProviderCredential('openrouter', 'oauth', data.key);
    return redirectToSettings(request, 'connected');
  } catch (error) {
    return redirectToSettings(
      request,
      'error',
      error instanceof Error ? error.message : 'OpenRouter OAuth exchange failed',
    );
  }
}
