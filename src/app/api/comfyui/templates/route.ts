import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../_utils/responses';
import {
  loadIndex,
  saveTemplate,
  ensureDefaultTemplate,
} from '@/lib/comfyui/workflowTemplateStore';
import type { ComfyUIWorkflowTemplate } from '@/lib/comfyui/types';

export const runtime = 'nodejs';

/** GET — list all workflow templates */
export async function GET() {
  try {
    await ensureDefaultTemplate();
    const templates = await loadIndex();
    return apiSuccess({ templates });
  } catch (err) {
    console.error('[ComfyUI Templates] List error:', err);
    return apiError(err instanceof Error ? err.message : 'Fehler', 500);
  }
}

/** POST — create a new workflow template */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ComfyUIWorkflowTemplate>;
    const { name, description, workflow } = body;

    if (!name || !workflow || typeof workflow !== 'object') {
      return apiError('name und workflow sind erforderlich', 400);
    }

    const id = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const template: ComfyUIWorkflowTemplate = {
      id,
      name,
      description: description || '',
      workflow: workflow as ComfyUIWorkflowTemplate['workflow'],
      createdAt: new Date().toISOString(),
    };

    await saveTemplate(template);
    return apiSuccess({ template });
  } catch (err) {
    console.error('[ComfyUI Templates] Create error:', err);
    return apiError(err instanceof Error ? err.message : 'Fehler', 500);
  }
}
