import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../../_utils/responses';
import { loadTemplate, deleteTemplate } from '@/lib/comfyui/workflowTemplateStore';

export const runtime = 'nodejs';

/** GET — load a single workflow template by ID */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const template = await loadTemplate(id);
    if (!template) {
      return apiError('Template nicht gefunden', 404);
    }
    return apiSuccess({ template });
  } catch (err) {
    console.error('[ComfyUI Templates] Get error:', err);
    return apiError(err instanceof Error ? err.message : 'Fehler', 500);
  }
}

/** DELETE — remove a workflow template by ID */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteTemplate(id);
    if (!deleted) {
      return apiError('Template nicht gefunden', 404);
    }
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error('[ComfyUI Templates] Delete error:', err);
    return apiError(err instanceof Error ? err.message : 'Fehler', 500);
  }
}
