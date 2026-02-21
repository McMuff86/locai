import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { apiError, apiSuccess } from '../../_utils/responses';
import {
  loadTemplate,
  ensureDefaultTemplate,
  replacePlaceholders,
} from '@/lib/comfyui/workflowTemplateStore';

export const runtime = 'nodejs';

function getSettings(): Record<string, unknown> {
  const homeDir = process.env.USERPROFILE || process.env.HOME || '.';
  const settingsPath = path.join(homeDir, '.locai', 'settings.json');
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {

  try {
    const body = await req.json() as {
      image?: string;
      prompt?: string;
      denoise?: number;
      workflowId?: string;
    };
    const { image, prompt, denoise = 0.6, workflowId } = body;

    if (!image || !prompt) {
      return apiError('Bild und Prompt erforderlich', 400);
    }

    const settings = getSettings();
    const comfyPort = (settings.comfyUIPort as number) || 8188;
    const comfyHost = 'localhost';

    // Check ComfyUI availability
    try {
      const statusRes = await fetch(`http://${comfyHost}:${comfyPort}/system_stats`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!statusRes.ok) throw new Error('ComfyUI not running');
    } catch {
      return apiError('ComfyUI ist nicht gestartet', 503);
    }

    // Upload the image to ComfyUI
    const imageBuffer = Buffer.from(image, 'base64');
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', blob, 'input_image.png');
    formData.append('overwrite', 'true');
    formData.append('type', 'input');

    const uploadRes = await fetch(`http://${comfyHost}:${comfyPort}/upload/image`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error('Bild-Upload zu ComfyUI fehlgeschlagen');
    }

    const uploadData = await uploadRes.json() as { name?: string };
    const inputImageName = uploadData.name || 'input_image.png';

    // Build workflow from template or use default
    await ensureDefaultTemplate();
    const templateId = workflowId || 'default-img2img';
    const template = await loadTemplate(templateId);

    if (!template) {
      return apiError(`Workflow-Template "${templateId}" nicht gefunden`, 404);
    }

    const workflow = replacePlaceholders(template.workflow, {
      image: inputImageName,
      prompt,
      denoise: Math.max(0.3, Math.min(0.9, denoise)),
    });

    // Find SaveImage node dynamically
    const saveNodeEntry = Object.entries(workflow).find(
      ([, n]) => n.class_type === 'SaveImage',
    );
    const saveNodeId = saveNodeEntry?.[0];

    if (!saveNodeId) {
      return apiError('Workflow enthält keinen SaveImage-Node', 400);
    }

    const queueRes = await fetch(`http://${comfyHost}:${comfyPort}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueRes.ok) {
      const errText = await queueRes.text();
      throw new Error(`ComfyUI Prompt fehlgeschlagen: ${errText}`);
    }

    const queueData = await queueRes.json() as { prompt_id: string };
    const promptId = queueData.prompt_id;

    // Poll for completion (max 120s)
    let resultImage: string | null = null;
    const maxWait = 120000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 2000));

      const historyRes = await fetch(`http://${comfyHost}:${comfyPort}/history/${promptId}`);
      if (!historyRes.ok) continue;

      const history = await historyRes.json() as Record<string, { outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> }>;
      const entry = history[promptId];
      if (!entry?.outputs?.[saveNodeId]?.images?.length) continue;

      const outputImage = entry.outputs[saveNodeId].images[0];
      const imgRes = await fetch(
        `http://${comfyHost}:${comfyPort}/view?filename=${outputImage.filename}&subfolder=${outputImage.subfolder || ''}&type=${outputImage.type || 'output'}`,
      );

      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        resultImage = Buffer.from(arrayBuf).toString('base64');
      }
      break;
    }

    if (!resultImage) {
      return apiError('Timeout: ComfyUI hat nicht rechtzeitig geantwortet', 504);
    }

    return apiSuccess({ resultImage });
  } catch (err) {
    console.error('[ImageEditor] AI edit error:', err);
    return apiError(err instanceof Error ? err.message : 'Fehler', 500);
  }
}
