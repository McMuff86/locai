// ============================================================================
// Memory Prune API Route (MEM-3)
// ============================================================================
// POST /api/memories/prune — archive old memories (>30 days without access)
// ============================================================================

import { pruneMemories } from '@/lib/memory/store';
import { apiError, apiSuccess } from '../../_utils/responses';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await pruneMemories();
    return apiSuccess({ ...result });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to prune memories', 500);
  }
}
