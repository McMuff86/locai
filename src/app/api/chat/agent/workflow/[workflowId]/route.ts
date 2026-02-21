// ============================================================================
// Workflow Cancel API Route
// ============================================================================
// DELETE /api/chat/agent/workflow/[workflowId] — cancel a running workflow
// ============================================================================

import { NextRequest } from 'next/server';
import { activeEngines } from '../route';
import { apiError, apiSuccess } from '../../../../_utils/responses';

export const dynamic = 'force-dynamic';

// DELETE /api/chat/agent/workflow/[workflowId] — cancel running workflow
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  try {
    const { workflowId } = await params;
    if (!workflowId) {
      return apiError('Workflow ID is required', 400);
    }

    const engine = activeEngines.get(workflowId);
    if (!engine) {
      return apiError('Workflow not found or already completed', 404);
    }

    engine.cancel();
    activeEngines.delete(workflowId);

    return apiSuccess({ workflowId, cancelled: true });
  } catch (err) {
    console.error('[API] DELETE /api/chat/agent/workflow/[workflowId] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to cancel workflow', 500);
  }
}
