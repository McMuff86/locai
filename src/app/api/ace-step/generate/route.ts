import { AceStepClient } from '@/lib/aceStep';
import type { GenerateOptions } from '@/lib/aceStep';
import { apiError, apiSuccess } from '../../_utils/responses';
import { assertLocalRequest } from '../../_utils/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  try {
    const body = await request.json() as Record<string, unknown>;

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

    const options: GenerateOptions = {
      taskType: (body.task_type as GenerateOptions['taskType']) || 'caption',
      caption: body.caption as string | undefined,
      lyrics: body.lyrics as string | undefined,
      description: body.description as string | undefined,
      duration: body.duration as number | undefined,
      bpm: body.bpm as number | undefined,
      batch: body.batch as number | undefined,
    };

    const taskInfo = await client.generate(options);
    return apiSuccess({ taskId: taskInfo.taskId, status: taskInfo.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return apiError(message, 500);
  }
}
