import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    const body = await req.json() as { image?: string; prompt?: string; denoise?: number };
    const { image, prompt, denoise = 0.6 } = body;

    if (!image || !prompt) {
      return NextResponse.json({ success: false, error: 'Bild und Prompt erforderlich' }, { status: 400 });
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
      return NextResponse.json({ success: false, error: 'ComfyUI ist nicht gestartet' }, { status: 503 });
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

    // Simple img2img workflow
    const workflow = {
      '1': { class_type: 'LoadImage', inputs: { image: inputImageName } },
      '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
      '3': { class_type: 'CLIPTextEncode', inputs: { text: 'low quality, blurry, distorted', clip: ['4', 1] } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
      '5': { class_type: 'VAEEncode', inputs: { pixels: ['1', 0], vae: ['4', 2] } },
      '6': {
        class_type: 'KSampler',
        inputs: {
          model: ['4', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['5', 0],
          seed: Math.floor(Math.random() * 1000000000),
          steps: 20, cfg: 7.0, sampler_name: 'euler', scheduler: 'normal',
          denoise: Math.max(0.3, Math.min(0.9, denoise)),
        },
      },
      '7': { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['4', 2] } },
      '8': { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'locai_edit' } },
    };

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
      if (!entry?.outputs?.['8']?.images?.length) continue;

      const outputImage = entry.outputs['8'].images[0];
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
      return NextResponse.json({ success: false, error: 'Timeout: ComfyUI hat nicht rechtzeitig geantwortet' }, { status: 504 });
    }

    return NextResponse.json({ success: true, resultImage });
  } catch (err) {
    console.error('[ImageEditor] AI edit error:', err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 });
  }
}
