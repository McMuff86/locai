import { AceStepClient } from '@/lib/aceStep';
import { apiError, apiSuccess } from '../../_utils/responses';
import { assertLocalRequest } from '../../_utils/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const url = (body.url as string) || undefined;

    let baseUrl = 'http://localhost:8001';
    if (url) {
      baseUrl = url;
    } else {
      try {
        const settingsRes = await fetch('http://localhost:3000/api/settings');
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.settings?.aceStepUrl) {
          baseUrl = settingsData.settings.aceStepUrl;
        }
      } catch {
        // use default
      }
    }

    const client = new AceStepClient({ baseUrl });
    const status = await client.health();
    return apiSuccess({ status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Health check failed';
    return apiError(message, 503);
  }
}
