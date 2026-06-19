import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'locai_openrouter_oauth';
const COOKIE_TTL_SECONDS = 10 * 60;

function base64Url(input: Buffer): string {
  return input.toString('base64url');
}

function createCodeChallenge(verifier: string): string {
  return base64Url(crypto.createHash('sha256').update(verifier).digest());
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const callbackUrl = new URL('/api/providers/openrouter/oauth/callback', origin);
  const state = base64Url(crypto.randomBytes(24));
  const codeVerifier = base64Url(crypto.randomBytes(48));
  const codeChallenge = createCodeChallenge(codeVerifier);
  callbackUrl.searchParams.set('state', state);

  const authUrl = new URL('https://openrouter.ai/auth');
  authUrl.searchParams.set('callback_url', callbackUrl.toString());
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: COOKIE_NAME,
    value: Buffer.from(JSON.stringify({ state, codeVerifier })).toString('base64url'),
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: COOKIE_TTL_SECONDS,
  });

  return response;
}
