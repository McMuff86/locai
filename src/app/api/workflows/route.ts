// ============================================================================
// Workflows API Route
// ============================================================================
// GET  — list workflow summaries
// POST — save a completed workflow
// ============================================================================

import { NextRequest } from 'next/server';
import { loadIndex, saveWorkflow } from '@/lib/agents/workflowStore';
import { apiError, apiSuccess } from '../_utils/responses';

export const dynamic = 'force-dynamic';

// GET /api/workflows — list workflow summaries
export async function GET() {
  try {
    const workflows = await loadIndex();
    return apiSuccess({ workflows });
  } catch (err) {
    console.error('[API] GET /api/workflows error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load workflows', 500);
  }
}

// POST /api/workflows — save a completed workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow } = body;

    if (!workflow?.id) {
      return apiError('Workflow with id is required', 400);
    }

    await saveWorkflow(workflow);
    return apiSuccess({ id: workflow.id });
  } catch (err) {
    console.error('[API] POST /api/workflows error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to save workflow', 500);
  }
}
