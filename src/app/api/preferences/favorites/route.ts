// ============================================================================
// Preferences: Favorites API Route
// ============================================================================
// GET  → load favorites
// POST → save favorites
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getLocaiBasePath } from '@/app/api/_utils/security';
import path from 'path';
import { promises as fs } from 'fs';

export const dynamic = 'force-dynamic';

async function getFavoritesPath(): Promise<string> {
  const base = await getLocaiBasePath('preferences');
  return path.join(base, 'favorites.json');
}

// GET /api/preferences/favorites
export async function GET() {
  try {
    const filePath = await getFavoritesPath();
    const raw = await fs.readFile(filePath, 'utf-8');
    const favorites = JSON.parse(raw);
    return NextResponse.json({ favorites });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ favorites: [] });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load favorites' },
      { status: 500 },
    );
  }
}

// POST /api/preferences/favorites
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { favorites } = body;

    if (!Array.isArray(favorites)) {
      return NextResponse.json({ error: 'favorites must be an array' }, { status: 400 });
    }

    const filePath = await getFavoritesPath();
    await fs.writeFile(filePath, JSON.stringify(favorites, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save favorites' },
      { status: 500 },
    );
  }
}
