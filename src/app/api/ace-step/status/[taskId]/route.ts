import { AceStepClient } from '@/lib/aceStep';
import { apiError, apiSuccess } from '../../../_utils/responses';
import { assertLocalRequest } from '../../../_utils/security';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const { taskId } = await params;

    let baseUrl = 'http://localhost:8001';
    try {
      const settingsRes = await fetch('http://localhost:3000/api/settings');
      const settingsData = await settingsRes.json();
      if (settingsData.success && settingsData.settings?.aceStepUrl) {
        baseUrl = settingsData.settings.aceStepUrl;
      }
    } catch {
      // use default
    }

    const client = new AceStepClient({ baseUrl });
    const results = await client.getStatus(taskId);
    return apiSuccess({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Status check failed';
    return apiError(message, 500);
  }
}
