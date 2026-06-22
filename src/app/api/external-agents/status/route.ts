import { apiError, apiSuccess } from '../../_utils/responses';
import { getExternalAgentStatuses } from '@/lib/external-agents/gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const agents = await getExternalAgentStatuses();
    return apiSuccess({ agents });
  } catch (err) {
    console.error('[API] GET /api/external-agents/status error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load external agent status', 500);
  }
}
