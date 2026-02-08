// ============================================================================
// Migration API Route
// ============================================================================
// POST → receive localStorage data and write to filesystem stores
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { saveConversation } from '@/lib/conversations/store';
import { getLocaiBasePath } from '@/app/api/_utils/security';
import path from 'path';
import { promises as fs } from 'fs';
import type { Conversation } from '@/types/chat';

export const dynamic = 'force-dynamic';

interface MigrationData {
  conversations?: Conversation[];
  settings?: Record<string, unknown>;
  favorites?: string[];
  graphSettings?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MigrationData;
    const results = {
      conversations: 0,
      settings: false,
      favorites: false,
      graphSettings: false,
    };

    // Migrate conversations
    if (Array.isArray(body.conversations)) {
      for (const conv of body.conversations) {
        if (conv?.id && conv?.title && Array.isArray(conv?.messages)) {
          try {
            await saveConversation(conv);
            results.conversations++;
          } catch (err) {
            console.error(`[Migration] Failed to save conversation ${conv.id}:`, err);
          }
        }
      }
    }

    // Migrate settings
    if (body.settings && typeof body.settings === 'object') {
      try {
        const basePath = await getLocaiBasePath();
        const settingsPath = path.join(basePath, 'settings.json');
        await fs.writeFile(settingsPath, JSON.stringify(body.settings, null, 2), 'utf-8');
        results.settings = true;
      } catch (err) {
        console.error('[Migration] Failed to save settings:', err);
      }
    }

    // Migrate favorites
    if (Array.isArray(body.favorites)) {
      try {
        const prefsPath = await getLocaiBasePath('preferences');
        const favPath = path.join(prefsPath, 'favorites.json');
        await fs.writeFile(favPath, JSON.stringify(body.favorites, null, 2), 'utf-8');
        results.favorites = true;
      } catch (err) {
        console.error('[Migration] Failed to save favorites:', err);
      }
    }

    // Migrate graph settings
    if (body.graphSettings && typeof body.graphSettings === 'object') {
      try {
        const prefsPath = await getLocaiBasePath('preferences');
        const graphPath = path.join(prefsPath, 'graph-settings.json');
        await fs.writeFile(graphPath, JSON.stringify(body.graphSettings, null, 2), 'utf-8');
        results.graphSettings = true;
      } catch (err) {
        console.error('[Migration] Failed to save graph settings:', err);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('[Migration] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Migration failed' },
      { status: 500 },
    );
  }
}
