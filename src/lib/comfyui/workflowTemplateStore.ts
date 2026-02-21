// ============================================================================
// ComfyUI Workflow Template Store — Filesystem Persistence
// ============================================================================
// Server-side CRUD for ComfyUI workflow templates.
// Pattern: src/lib/agents/workflowStore.ts (index.json + {id}.json)
//
// Path: ~/.locai/comfyui-workflows/
// ============================================================================

import path from 'path';
import { promises as fs } from 'fs';
import type { ComfyUIWorkflowTemplate, ComfyUITemplateSummary } from './types';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function defaultBasePath(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '/tmp';
  return path.join(home, '.locai', 'comfyui-workflows');
}

function indexFilePath(basePath: string): string {
  return path.join(basePath, 'index.json');
}

function templateFilePath(basePath: string, id: string): string {
  return path.join(basePath, `${id}.json`);
}

async function ensureDir(basePath: string): Promise<void> {
  await fs.mkdir(basePath, { recursive: true });
}

// ---------------------------------------------------------------------------
// Build summary from full template
// ---------------------------------------------------------------------------

function buildSummary(t: ComfyUIWorkflowTemplate): ComfyUITemplateSummary {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    createdAt: t.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Index operations
// ---------------------------------------------------------------------------

export async function loadIndex(basePath?: string): Promise<ComfyUITemplateSummary[]> {
  const dir = basePath || defaultBasePath();
  const filePath = indexFilePath(dir);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ComfyUITemplateSummary[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('[ComfyUITemplateStore] Failed to load index:', err);
    return [];
  }
}

async function saveIndex(basePath: string, index: ComfyUITemplateSummary[]): Promise<void> {
  await ensureDir(basePath);
  await fs.writeFile(indexFilePath(basePath), JSON.stringify(index, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function loadTemplate(
  id: string,
  basePath?: string,
): Promise<ComfyUIWorkflowTemplate | null> {
  if (!id || /[/\\]/.test(id)) return null;
  const dir = basePath || defaultBasePath();
  try {
    const raw = await fs.readFile(templateFilePath(dir, id), 'utf-8');
    return JSON.parse(raw) as ComfyUIWorkflowTemplate;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    console.error(`[ComfyUITemplateStore] Failed to load template ${id}:`, err);
    return null;
  }
}

export async function saveTemplate(
  template: ComfyUIWorkflowTemplate,
  basePath?: string,
): Promise<void> {
  if (!template.id || /[/\\]/.test(template.id)) {
    throw new Error('Invalid template ID');
  }
  const dir = basePath || defaultBasePath();
  await ensureDir(dir);

  await fs.writeFile(
    templateFilePath(dir, template.id),
    JSON.stringify(template, null, 2),
    'utf-8',
  );

  const index = await loadIndex(dir);
  const summary = buildSummary(template);
  const idx = index.findIndex((s) => s.id === template.id);
  if (idx >= 0) {
    index[idx] = summary;
  } else {
    index.push(summary);
  }

  index.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  await saveIndex(dir, index);
}

export async function deleteTemplate(
  id: string,
  basePath?: string,
): Promise<boolean> {
  if (!id || /[/\\]/.test(id)) return false;
  const dir = basePath || defaultBasePath();

  const index = await loadIndex(dir);
  const filtered = index.filter((s) => s.id !== id);
  if (filtered.length === index.length) return false;

  await saveIndex(dir, filtered);

  try {
    await fs.unlink(templateFilePath(dir, id));
  } catch {
    // File may not exist
  }

  return true;
}

// ---------------------------------------------------------------------------
// Default template
// ---------------------------------------------------------------------------

const DEFAULT_TEMPLATE_ID = 'default-img2img';

function createDefaultTemplate(): ComfyUIWorkflowTemplate {
  return {
    id: DEFAULT_TEMPLATE_ID,
    name: 'Standard img2img (SDXL)',
    description: 'Default img2img workflow using SDXL base checkpoint',
    workflow: {
      '1': { class_type: 'LoadImage', inputs: { image: '{{IMAGE}}' } },
      '2': { class_type: 'CLIPTextEncode', inputs: { text: '{{PROMPT}}', clip: ['4', 1] } },
      '3': { class_type: 'CLIPTextEncode', inputs: { text: '{{NEGATIVE_PROMPT}}', clip: ['4', 1] } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
      '5': { class_type: 'VAEEncode', inputs: { pixels: ['1', 0], vae: ['4', 2] } },
      '6': {
        class_type: 'KSampler',
        inputs: {
          model: ['4', 0],
          positive: ['2', 0],
          negative: ['3', 0],
          latent_image: ['5', 0],
          seed: '{{SEED}}',
          steps: '{{STEPS}}',
          cfg: '{{CFG}}',
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: '{{DENOISE}}',
        },
      },
      '7': { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['4', 2] } },
      '8': { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'locai_edit' } },
    },
    createdAt: new Date().toISOString(),
  };
}

export async function ensureDefaultTemplate(basePath?: string): Promise<void> {
  const existing = await loadTemplate(DEFAULT_TEMPLATE_ID, basePath);
  if (!existing) {
    await saveTemplate(createDefaultTemplate(), basePath);
  }
}

// ---------------------------------------------------------------------------
// Placeholder replacement
// ---------------------------------------------------------------------------

interface PlaceholderValues {
  image: string;
  prompt: string;
  negativePrompt?: string;
  denoise?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
}

const NUMERIC_PLACEHOLDERS = new Set(['{{DENOISE}}', '{{SEED}}', '{{STEPS}}', '{{CFG}}']);

export function replacePlaceholders(
  workflow: ComfyUIWorkflowTemplate['workflow'],
  values: PlaceholderValues,
): ComfyUIWorkflowTemplate['workflow'] {
  const defaults: Record<string, string | number> = {
    '{{IMAGE}}': values.image,
    '{{PROMPT}}': values.prompt,
    '{{NEGATIVE_PROMPT}}': values.negativePrompt || 'low quality, blurry, distorted',
    '{{DENOISE}}': values.denoise ?? 0.6,
    '{{SEED}}': values.seed ?? Math.floor(Math.random() * 1000000000),
    '{{STEPS}}': values.steps ?? 20,
    '{{CFG}}': values.cfg ?? 7.0,
  };

  const json = JSON.stringify(workflow);

  const replaced = json.replace(/"{{[A-Z_]+}}"/g, (match) => {
    // match includes surrounding quotes, e.g. "\"{{PROMPT}}\""
    const placeholder = match.slice(1, -1); // remove outer quotes → {{PROMPT}}
    const value = defaults[placeholder];
    if (value === undefined) return match;

    if (NUMERIC_PLACEHOLDERS.has(placeholder)) {
      return String(value); // emit raw number (no quotes)
    }
    return JSON.stringify(String(value)); // emit properly escaped string
  });

  return JSON.parse(replaced) as ComfyUIWorkflowTemplate['workflow'];
}
