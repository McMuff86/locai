import { NextResponse } from 'next/server';
import {
  deleteStoredProviderCredential,
  maskCredential,
  readStoredProviderCredential,
} from '@/lib/providers/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const credential = readStoredProviderCredential('openrouter');
  return NextResponse.json({
    connected: !!credential,
    authMode: credential?.authMode ?? 'none',
    credential: maskCredential(credential?.credential),
    updatedAt: credential?.updatedAt,
  });
}

export async function DELETE() {
  const deleted = deleteStoredProviderCredential('openrouter');
  return NextResponse.json({ success: true, deleted });
}
