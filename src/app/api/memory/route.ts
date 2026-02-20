// ============================================================================
// Memory API Route
// ============================================================================
// GET  → list memories (optional ?q=search query)
// POST → save a memory
// DELETE → delete a memory by id
// ============================================================================

import { NextRequest } from 'next/server';
import { listMemories, searchMemories, saveMemory, deleteMemory } from '@/lib/memory/store';
import { apiError, apiSuccess } from '../_utils/responses';

export const dynamic = 'force-dynamic';

// GET /api/memory?q=optional_search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (query) {
      const results = await searchMemories(query);
      return apiSuccess({ memories: results });
    }

    const memories = await listMemories();
    return apiSuccess({ memories });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load memories', 500);
  }
}

// POST /api/memory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, category, tags, source } = body;

    if (!key || !value || !category) {
      return apiError('key, value, and category are required', 400);
    }

    const entry = await saveMemory({ key, value, category, tags, source });
    return apiSuccess({ entry });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to save memory', 500);
  }
}

// DELETE /api/memory?id={id}
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('id parameter required', 400);
    }

    const deleted = await deleteMemory(id);
    if (!deleted) {
      return apiError('Memory not found', 404);
    }

    return apiSuccess();
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to delete memory', 500);
  }
}
