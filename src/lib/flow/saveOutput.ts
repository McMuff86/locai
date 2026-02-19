/**
 * Saves flow output to the workspace, handling both new and existing files.
 * Provides auto-naming when no file path is configured.
 */

function generateAutoName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `FlowOutput_${date}_${time}.txt`;
}

function splitPath(filePath: string): { parentPath: string; name: string } {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) {
    return { parentPath: '', name: normalized };
  }
  return {
    parentPath: normalized.slice(0, lastSlash),
    name: normalized.slice(lastSlash + 1),
  };
}

export interface SaveFlowOutputResult {
  success: boolean;
  savedPath: string;
  error?: string;
}

export async function saveFlowOutput(
  content: string,
  filePath?: string,
): Promise<SaveFlowOutputResult> {
  const resolvedPath = filePath?.trim() || generateAutoName();
  const { parentPath, name } = splitPath(resolvedPath);

  // If there's a parent directory, ensure it exists.
  if (parentPath) {
    try {
      await fetch('/api/filebrowser/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootId: 'workspace',
          path: '',
          name: parentPath,
          type: 'directory',
        }),
      });
      // Ignore errors — directory may already exist (409).
    } catch {
      // Best-effort directory creation.
    }
  }

  // Try to overwrite existing file first.
  const writeRes = await fetch('/api/filebrowser/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rootId: 'workspace',
      path: resolvedPath,
      content,
    }),
  });

  if (writeRes.ok) {
    return { success: true, savedPath: resolvedPath };
  }

  // File does not exist yet — create it.
  const createRes = await fetch('/api/filebrowser/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rootId: 'workspace',
      path: parentPath,
      name,
      type: 'file',
      content,
    }),
  });

  if (createRes.ok) {
    return { success: true, savedPath: resolvedPath };
  }

  const errorBody = await createRes.json().catch(() => null);
  const errorMessage =
    (errorBody as { error?: string } | null)?.error ?? 'Datei konnte nicht gespeichert werden.';

  return { success: false, savedPath: resolvedPath, error: errorMessage };
}
