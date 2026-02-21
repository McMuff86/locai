// ============================================================================
// Workflows [id] API Route
// ============================================================================
// GET    — load a single workflow by ID
// DELETE — delete a single workflow by ID
// ============================================================================

import { NextRequest } from 'next/server';
import { loadWorkflow, deleteWorkflow } from '@/lib/agents/workflowStore';
import { apiError, apiSuccess } from '../../_utils/responses';

export const dynamic = 'force-dynamic';

// GET /api/workflows/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return apiError('Workflow ID is required', 400);
    }

    const workflow = await loadWorkflow(id);
    if (!workflow) {
      return apiError('Workflow not found', 404);
    }

    return apiSuccess({ workflow });
  } catch (err) {
    console.error('[API] GET /api/workflows/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load workflow', 500);
  }
}

// DELETE /api/workflows/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return apiError('Workflow ID is required', 400);
    }

    const deleted = await deleteWorkflow(id);
    if (!deleted) {
      return apiError('Workflow not found', 404);
    }

    return apiSuccess();
  } catch (err) {
    console.error('[API] DELETE /api/workflows/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to delete workflow', 500);
  }
}
