// ============================================================================
// Built-in Tool: generate_image
// ============================================================================
// Generates an image using the ComfyUI integration.
// Checks if ComfyUI is running, then queues a prompt.
// ============================================================================

import { RegisteredTool, ToolResult } from '../types';

const COMFYUI_DEFAULT_HOST = 'http://127.0.0.1:8188';

async function getComfyUIHost(): Promise<string> {
  // Try to read from settings via internal API
  try {
    const res = await fetch('http://localhost:3000/api/settings');
    const data = await res.json();
    if (data.success && data.settings?.comfyUIPort) {
      return `http://127.0.0.1:${data.settings.comfyUIPort}`;
    }
  } catch {
    // Fall through to default
  }
  return COMFYUI_DEFAULT_HOST;
}

async function checkComfyUIStatus(host: string): Promise<boolean> {
  try {
    const res = await fetch(`${host}/system_stats`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

const generateImageTool: RegisteredTool = {
  definition: {
    name: 'generate_image',
    description:
      'Generate an image using the local ComfyUI image generation system. ' +
      'ComfyUI must be running locally. Provide a descriptive prompt for the image. ' +
      'Returns a status message about the queued generation.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed text description of the image to generate',
        },
        negative_prompt: {
          type: 'string',
          description: 'Things to avoid in the generated image (optional)',
        },
        width: {
          type: 'integer',
          description: 'Image width in pixels (default: 512)',
        },
        height: {
          type: 'integer',
          description: 'Image height in pixels (default: 512)',
        },
      },
      required: ['prompt'],
    },
    enabled: true,
    category: 'media',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const prompt = args.prompt as string | undefined;
    const negativePrompt = (args.negative_prompt as string) || '';
    const width = (args.width as number) || 512;
    const height = (args.height as number) || 512;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return {
        callId,
        content: '',
        error: 'Parameter "prompt" is required and must be a non-empty string',
        success: false,
      };
    }

    const host = await getComfyUIHost();
    const isRunning = await checkComfyUIStatus(host);

    if (!isRunning) {
      return {
        callId,
        content: '',
        error: `ComfyUI is not running at ${host}. Please start ComfyUI first (Settings → ComfyUI → Start).`,
        success: false,
      };
    }

    // Build a simple txt2img workflow for ComfyUI API
    const workflow = {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: Math.floor(Math.random() * 2 ** 32),
          steps: 20,
          cfg: 7,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: 'v1-5-pruned-emaonly.safetensors',
        },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width,
          height,
          batch_size: 1,
        },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: prompt,
          clip: ['4', 1],
        },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: negativePrompt || 'bad quality, blurry, deformed',
          clip: ['4', 1],
        },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['3', 0],
          vae: ['4', 2],
        },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'agent_gen',
          images: ['8', 0],
        },
      },
    };

    try {
      const res = await fetch(`${host}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          callId,
          content: '',
          error: `ComfyUI returned error ${res.status}: ${text.slice(0, 200)}`,
          success: false,
        };
      }

      const data = await res.json();
      return {
        callId,
        content: `Image generation queued successfully.\nPrompt ID: ${data.prompt_id}\nSize: ${width}x${height}\nPrompt: "${prompt}"\nThe image will be available in the ComfyUI output gallery once generation completes.`,
        success: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to queue image generation';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default generateImageTool;
