// ============================================================================
// Preferences: Graph Settings API Route
// ============================================================================
// GET  → load graph settings
// POST → save graph settings
// ============================================================================

import { NextRequest } from 'next/server';
import { getLocaiBasePath } from '@/app/api/_utils/security';
import { apiError, apiSuccess } from '../../_utils/responses';
import path from 'path';
import { promises as fs } from 'fs';

export const dynamic = 'force-dynamic';

async function getGraphSettingsPath(): Promise<string> {
  const base = await getLocaiBasePath('preferences');
  return path.join(base, 'graph-settings.json');
}

// GET /api/preferences/graph
export async function GET() {
  try {
    const filePath = await getGraphSettingsPath();
    const raw = await fs.readFile(filePath, 'utf-8');
    const settings = JSON.parse(raw);
    return apiSuccess({ settings });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return apiSuccess({ settings: null });
    }
    return apiError(err instanceof Error ? err.message : 'Failed to load graph settings', 500);
  }
}

// POST /api/preferences/graph
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return apiError('settings object required', 400);
    }

    const filePath = await getGraphSettingsPath();
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
    return apiSuccess();
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to save graph settings', 500);
  }
}
