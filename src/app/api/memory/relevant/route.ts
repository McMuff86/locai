// ============================================================================
// Memory Relevant API Route
// ============================================================================
// GET /api/memory/relevant?message=... → context-based relevant memories
// ============================================================================

import { NextRequest } from 'next/server';
import { getRelevantMemories } from '@/lib/memory/store';
import { apiError, apiSuccess } from '../../_utils/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get('message');
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 10, 50) : 10;

    if (!message) {
      return apiError('message parameter required', 400);
    }

    const memories = await getRelevantMemories(message, limit);
    return apiSuccess({ memories });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to get relevant memories', 500);
  }
}
