// ============================================================================
// Preferences: Favorites API Route
// ============================================================================
// GET  → load favorites
// POST → save favorites
// ============================================================================

import { NextRequest } from 'next/server';
import { getLocaiBasePath } from '@/app/api/_utils/security';
import { apiError, apiSuccess } from '../../_utils/responses';
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
    return apiSuccess({ favorites });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return apiSuccess({ favorites: [] });
    }
    return apiError(err instanceof Error ? err.message : 'Failed to load favorites', 500);
  }
}

// POST /api/preferences/favorites
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { favorites } = body;

    if (!Array.isArray(favorites)) {
      return apiError('favorites must be an array', 400);
    }

    const filePath = await getFavoritesPath();
    await fs.writeFile(filePath, JSON.stringify(favorites, null, 2), 'utf-8');
    return apiSuccess();
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to save favorites', 500);
  }
}
