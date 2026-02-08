// ============================================================================
// Server-side Settings Reader
// ============================================================================
// Reads ~/.locai/settings.json directly from the filesystem.
// Used by agent tools to access user settings without going through the API.
// ============================================================================

import fs from 'fs';
import path from 'path';

/** Subset of AppSettings relevant for server-side tool use */
export interface ServerSettings {
  agentWorkspacePath: string;
  notesPath: string;
  ollamaHost: string;
  comfyUIPort: number;
}

const DEFAULTS: ServerSettings = {
  agentWorkspacePath: '',
  notesPath: '',
  ollamaHost: 'http://localhost:11434',
  comfyUIPort: 8188,
};

/** Home directory of the current user */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/** Path to the settings.json file */
function getSettingsPath(): string {
  const home = getHomeDir();
  return path.join(home, '.locai', 'settings.json');
}

/**
 * Read settings from ~/.locai/settings.json (synchronous, cached per-request).
 * Returns defaults for any missing keys.
 */
export function loadServerSettings(): ServerSettings {
  try {
    const filePath = getSettingsPath();
    if (!fs.existsSync(filePath)) return { ...DEFAULTS };
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Resolve the agent workspace directory.
 * Priority: settings.agentWorkspacePath > ~/.locai/workspace/
 */
export function resolveWorkspacePath(): string {
  const settings = loadServerSettings();
  if (settings.agentWorkspacePath) {
    return path.resolve(settings.agentWorkspacePath);
  }
  const home = getHomeDir();
  return home ? path.resolve(home, '.locai', 'workspace') : '';
}

/**
 * Resolve the notes base directory.
 * Priority: settings.notesPath > LOCAL_NOTES_PATH env > ~/.locai/notes/
 */
export function resolveNotesBasePath(): string {
  const settings = loadServerSettings();
  if (settings.notesPath) {
    return path.resolve(settings.notesPath);
  }
  const envPath = process.env.LOCAL_NOTES_PATH;
  if (envPath) {
    return path.resolve(envPath);
  }
  const home = getHomeDir();
  return home ? path.resolve(home, '.locai', 'notes') : '';
}
