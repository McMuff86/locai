// ============================================================================
// Memory Semantic Search API Route (MEM-3)
// ============================================================================
// GET /api/memories/search?q=... — semantic search over memories
// ============================================================================

import { NextRequest } from 'next/server';
import { semanticSearch, searchMemories } from '@/lib/memory/store';
import { apiError, apiSuccess } from '../../_utils/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');

    if (!query) {
      return apiError('Query parameter "q" is required', 400);
    }

    // Try semantic search, fall back to keyword search
    let memories;
    try {
      memories = await semanticSearch(query, limit, threshold);
    } catch {
      memories = await searchMemories(query, limit);
    }

    return apiSuccess({ memories, count: memories.length });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to search memories', 500);
  }
}
