// ============================================================================
// Memory by ID API Route (MEM-3)
// ============================================================================
// DELETE /api/memories/[id] — delete a memory by ID
// ============================================================================

import { NextRequest } from 'next/server';
import { deleteMemory, updateMemory } from '@/lib/memory/store';
import { apiError, apiSuccess } from '../../_utils/responses';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return apiError('Memory ID is required', 400);
    }

    const body = await request.json();
    const { key, value, category, tags } = body;

    const updated = await updateMemory(id, { key, value, category, tags });
    if (!updated) {
      return apiError('Memory not found', 404);
    }

    return apiSuccess({ entry: updated });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to update memory', 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return apiError('Memory ID is required', 400);
    }

    const deleted = await deleteMemory(id);
    if (!deleted) {
      return apiError('Memory not found', 404);
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to delete memory', 500);
  }
}
