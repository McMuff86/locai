import fs from 'fs';
import path from 'path';
import { apiError, apiSuccess } from '../_utils/responses';

export const dynamic = 'force-dynamic';

// Default settings
const DEFAULT_SETTINGS: Record<string, unknown> = {
  comfyUIPath: '',
  comfyUIPort: 8188,
  comfyUIAutoStart: false,
  comfyUIOutputPath: '',
  ollamaHost: 'http://localhost:11434',
  sidebarWidth: 400,
  theme: 'dark',
  autoSave: true,
  streamingEnabled: true,
  notesPath: '',
  notesEmbeddingModel: 'nomic-embed-text',
  notesAllowAI: true,
  agentWorkspacePath: '',
  aceStepUrl: 'http://localhost:8001',
  aceStepPath: '',
  aceStepAutoStart: false,
  qwenTTSUrl: 'http://localhost:7861',
};

// ── Settings validation schema ──────────────────────────────────────
// Only keys in this schema are accepted. Unknown keys are stripped.

const ALLOWED_THEMES = ['light', 'dark', 'system'] as const;

type FieldType = 'string' | 'number' | 'boolean' | 'url' | 'path';

interface FieldSchema {
  type: FieldType;
  min?: number;
  max?: number;
  maxLength?: number;
  enum?: readonly string[];
}

const SETTINGS_SCHEMA: Record<string, FieldSchema> = {
  comfyUIPath:          { type: 'path', maxLength: 500 },
  comfyUIPort:          { type: 'number', min: 1, max: 65535 },
  comfyUIAutoStart:     { type: 'boolean' },
  comfyUIOutputPath:    { type: 'path', maxLength: 500 },
  ollamaHost:           { type: 'url', maxLength: 500 },
  sidebarWidth:         { type: 'number', min: 100, max: 2000 },
  theme:                { type: 'string', enum: ALLOWED_THEMES, maxLength: 10 },
  autoSave:             { type: 'boolean' },
  streamingEnabled:     { type: 'boolean' },
  notesPath:            { type: 'path', maxLength: 500 },
  notesEmbeddingModel:  { type: 'string', maxLength: 100 },
  notesAllowAI:         { type: 'boolean' },
  agentWorkspacePath:   { type: 'path', maxLength: 500 },
  aceStepUrl:           { type: 'url', maxLength: 500 },
  aceStepPath:          { type: 'path', maxLength: 500 },
  aceStepAutoStart:     { type: 'boolean' },
  qwenTTSUrl:           { type: 'url', maxLength: 500 },
};

/**
 * Validate and sanitize user-supplied settings.
 * - Strips unknown keys
 * - Type-checks each value
 * - Enforces ranges and string lengths
 * - Rejects paths containing '..'
 * - Validates URL format for url-type fields
 */
function validateSettings(raw: unknown): { valid: true; settings: Record<string, unknown> } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Settings must be a JSON object' };
  }

  const input = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [key, schema] of Object.entries(SETTINGS_SCHEMA)) {
    if (!(key in input)) continue; // not provided → skip (keep default)
    const value = input[key];

    // Allow empty string for string/path/url fields (means "use default")
    if (value === '' && (schema.type === 'string' || schema.type === 'path' || schema.type === 'url')) {
      result[key] = '';
      continue;
    }

    switch (schema.type) {
      case 'string': {
        if (typeof value !== 'string') { errors.push(`${key}: must be a string`); continue; }
        if (schema.maxLength && value.length > schema.maxLength) { errors.push(`${key}: max length ${schema.maxLength}`); continue; }
        if (schema.enum && !(schema.enum as readonly string[]).includes(value)) { errors.push(`${key}: must be one of ${schema.enum.join(', ')}`); continue; }
        result[key] = value;
        break;
      }
      case 'number': {
        const num = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(num)) { errors.push(`${key}: must be a number`); continue; }
        if (schema.min !== undefined && num < schema.min) { errors.push(`${key}: min ${schema.min}`); continue; }
        if (schema.max !== undefined && num > schema.max) { errors.push(`${key}: max ${schema.max}`); continue; }
        result[key] = num;
        break;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') { errors.push(`${key}: must be a boolean`); continue; }
        result[key] = value;
        break;
      }
      case 'url': {
        if (typeof value !== 'string') { errors.push(`${key}: must be a string`); continue; }
        if (schema.maxLength && value.length > schema.maxLength) { errors.push(`${key}: max length ${schema.maxLength}`); continue; }
        try { new URL(value); } catch { errors.push(`${key}: invalid URL format`); continue; }
        result[key] = value;
        break;
      }
      case 'path': {
        if (typeof value !== 'string') { errors.push(`${key}: must be a string`); continue; }
        if (schema.maxLength && value.length > schema.maxLength) { errors.push(`${key}: max length ${schema.maxLength}`); continue; }
        if (value.includes('..')) { errors.push(`${key}: path must not contain '..'`); continue; }
        result[key] = value;
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: `Invalid settings: ${errors.join('; ')}` };
  }

  return { valid: true, settings: result };
}

// Get settings file path - always under ~/.locai/
function getSettingsPath(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || '.';
  return path.join(homeDir, '.locai', 'settings.json');
}

// Ensure directory exists
function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// GET - Load settings from file
export async function GET() {
  try {
    const settingsPath = getSettingsPath();

    if (!fs.existsSync(settingsPath)) {
      return apiSuccess({
        settings: DEFAULT_SETTINGS,
        source: 'default',
        path: settingsPath,
      });
    }

    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    return apiSuccess({
      settings: { ...DEFAULT_SETTINGS, ...settings },
      source: 'file',
      path: settingsPath,
    });

  } catch (error) {
    console.error('Error loading settings:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to load settings',
      500,
      { settings: DEFAULT_SETTINGS },
    );
  }
}

// POST - Save settings to file
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return apiError('No settings provided', 400);
    }

    // Validate and sanitize settings (strip unknown keys, check types/ranges)
    const validation = validateSettings(settings);
    if (!validation.valid) {
      return apiError(validation.error, 400);
    }

    // Merge validated settings with existing ones (so partial updates work)
    const settingsPath = getSettingsPath();
    let existing: Record<string, unknown> = {};
    try {
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        existing = JSON.parse(content);
      }
    } catch {
      // Ignore read errors, start fresh
    }

    const merged = { ...existing, ...validation.settings };

    // Ensure directory exists
    ensureDir(settingsPath);

    // Write settings
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');

    return apiSuccess({
      message: 'Settings saved',
      path: settingsPath,
    });

  } catch (error) {
    console.error('Error saving settings:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to save settings',
      500,
    );
  }
}

// DELETE - Reset settings
export async function DELETE() {
  try {
    const settingsPath = getSettingsPath();

    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }

    return apiSuccess({ message: 'Settings reset' });

  } catch (error) {
    console.error('Error deleting settings:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to reset settings',
      500,
    );
  }
}

