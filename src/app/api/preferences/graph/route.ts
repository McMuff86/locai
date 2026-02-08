// ============================================================================
// Preferences: Graph Settings API Route
// ============================================================================
// GET  → load graph settings
// POST → save graph settings
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getLocaiBasePath } from '@/app/api/_utils/security';
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
    return NextResponse.json({ settings });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ settings: null });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load graph settings' },
      { status: 500 },
    );
  }
}

// POST /api/preferences/graph
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'settings object required' }, { status: 400 });
    }

    const filePath = await getGraphSettingsPath();
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save graph settings' },
      { status: 500 },
    );
  }
}
