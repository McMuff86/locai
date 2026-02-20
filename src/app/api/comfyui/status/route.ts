import { validateComfyuiUrl } from '../../_utils/security';
import { apiError, apiSuccess } from '../../_utils/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const port = searchParams.get('port') || '8188';
    const host = searchParams.get('host') || 'localhost';

    // SSRF: validate and construct ComfyUI URL safely
    const urlCheck = validateComfyuiUrl(host, port);
    if (!urlCheck.valid) {
      return apiError(urlCheck.reason, 400, { running: false });
    }
    const comfyUrl = urlCheck.url;

    // Try to connect to ComfyUI
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const response = await fetch(`${comfyUrl}/system_stats`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return apiSuccess({
          running: true,
          port: parseInt(port),
          host,
          systemStats: data,
        });
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // ComfyUI not running or not reachable
    }

    return apiSuccess({
      running: false,
      port: parseInt(port),
      host,
    });

  } catch (error) {
    console.error('ComfyUI status check error:', error);
    return apiSuccess({
      running: false,
      error: 'Failed to check ComfyUI status',
    });
  }
}

