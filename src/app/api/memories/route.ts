// ============================================================================
// Memories API Route (MEM-3)
// ============================================================================
// GET  /api/memories       — list all memories (with pagination)
// POST /api/memories       — create a new memory (with embedding)
// ============================================================================

import { NextRequest } from 'next/server';
import { listMemories, saveMemoryWithEmbedding } from '@/lib/memory/store';
import { apiError, apiSuccess } from '../_utils/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const allMemories = await listMemories();
    const total = allMemories.length;
    const offset = (page - 1) * limit;
    const memories = allMemories.slice(offset, offset + limit);

    return apiSuccess({
      memories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to list memories', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, category, type, tags, source, metadata } = body;

    if (!key || !value || !category) {
      return apiError('key, value, and category are required', 400);
    }

    const entry = await saveMemoryWithEmbedding({
      key,
      value,
      category,
      type,
      tags,
      source,
      metadata,
    });

    return apiSuccess({ entry });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to save memory', 500);
  }
}
