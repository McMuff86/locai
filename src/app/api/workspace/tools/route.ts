import { apiError, apiSuccess } from '../../_utils/responses';
import { ToolRegistry } from '@/lib/agents/registry';
import { registerBuiltinTools } from '@/lib/agents/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const registry = new ToolRegistry();
    registerBuiltinTools(registry);
    const tools = registry.listGatewayEntries();
    return apiSuccess({ tools, count: tools.length });
  } catch (err) {
    console.error('[API] GET /api/workspace/tools error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load tools', 500);
  }
}
