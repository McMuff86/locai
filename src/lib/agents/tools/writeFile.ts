// ============================================================================
// Built-in Tool: write_file
// ============================================================================
// Write a file to the user's allowed directories.
// Includes security checks to prevent path traversal.
// Supports create (fail if exists) and overwrite modes.
// Relative paths are resolved to the agent workspace (~/.locai/workspace/).
// ============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { RegisteredTool, ToolResult } from '../types';
import { resolveWorkspacePath, getHomeDir } from '../../settings/store';

/** Maximum content size in characters */
const MAX_CONTENT_SIZE = 100_000;

/**
 * Resolve allowed base directories for file writing.
 * Includes workspace path from settings, env vars, and defaults.
 */
function getAllowedPaths(): string[] {
  const paths: string[] = [];

  // Agent workspace (primary write target)
  const workspace = resolveWorkspacePath();
  if (workspace) paths.push(workspace);

  const dataPath = process.env.LOCAI_DATA_PATH;
  if (dataPath) paths.push(path.resolve(dataPath));

  const notesPath = process.env.LOCAL_NOTES_PATH;
  if (notesPath) paths.push(path.resolve(notesPath));

  const home = getHomeDir();
  if (home) {
    paths.push(path.resolve(home, '.locai'));
    paths.push(path.resolve(home, 'Documents'));
  }

  return paths;
}

function isPathAllowed(resolvedPath: string, allowedPaths: string[]): boolean {
  return allowedPaths.some(
    (allowed) =>
      resolvedPath === allowed ||
      resolvedPath.startsWith(allowed + path.sep),
  );
}

const writeFileTool: RegisteredTool = {
  definition: {
    name: 'write_file',
    description:
      'Write content to a file. Relative paths (e.g. "test.txt" or "subfolder/file.md") ' +
      'are saved to the agent workspace (~/.locai/workspace/). ' +
      'Creates parent directories automatically. ' +
      'In "overwrite" mode (default), replaces existing file content. ' +
      'In "create" mode, fails if the file already exists.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'File path. Relative paths are saved in the workspace. ' +
            'Example: "report.txt" or "notes/summary.md"',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
        mode: {
          type: 'string',
          description: 'Write mode: "overwrite" (replace existing, default) or "create" (fail if exists).',
          enum: ['create', 'overwrite'],
          default: 'overwrite',
        },
      },
      required: ['path', 'content'],
    },
    enabled: true,
    category: 'files',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const filePath = args.path as string | undefined;
    const content = args.content as string | undefined;
    const mode = (args.mode as string) || 'overwrite';

    // --- Parameter validation ---

    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
      return {
        callId,
        content: '',
        error:
          'Parameter "path" is required and must be a non-empty string. ' +
          'Expected: write_file(path: "dateiname.txt", content: "Inhalt der Datei"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    if (content === undefined || content === null || typeof content !== 'string') {
      return {
        callId,
        content: '',
        error:
          'Parameter "content" is required and must be a string. ' +
          'Expected: write_file(path: "dateiname.txt", content: "Inhalt der Datei"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    if (mode !== 'create' && mode !== 'overwrite') {
      return {
        callId,
        content: '',
        error: 'Parameter "mode" must be "create" or "overwrite"',
        success: false,
      };
    }

    if (content.length > MAX_CONTENT_SIZE) {
      return {
        callId,
        content: '',
        error: `Content too large: ${content.length} characters (max ${MAX_CONTENT_SIZE})`,
        success: false,
      };
    }

    // --- Security checks ---

    if (filePath.includes('..') || filePath.includes('\0')) {
      return {
        callId,
        content: '',
        error: 'Path traversal ("..") or null bytes are not allowed',
        success: false,
      };
    }

    // Resolve relative paths to workspace directory
    let resolved: string;
    if (path.isAbsolute(filePath)) {
      resolved = path.resolve(filePath);
    } else {
      const workspace = resolveWorkspacePath();
      if (!workspace) {
        return {
          callId,
          content: '',
          error: 'No workspace path configured and HOME directory not found.',
          success: false,
        };
      }
      resolved = path.resolve(workspace, filePath);
    }

    const allowed = getAllowedPaths();

    if (allowed.length === 0) {
      return {
        callId,
        content: '',
        error:
          'No allowed file paths configured. Check agent workspace settings.',
        success: false,
      };
    }

    if (!isPathAllowed(resolved, allowed)) {
      return {
        callId,
        content: '',
        error: 'Access denied: file is outside allowed directories',
        success: false,
      };
    }

    // --- Write logic ---

    try {
      // Check if file already exists
      let fileExists = false;
      try {
        await fs.stat(resolved);
        fileExists = true;
      } catch {
        // File does not exist – OK
      }

      if (mode === 'create' && fileExists) {
        return {
          callId,
          content: '',
          error: `File already exists: ${resolved}. Use mode "overwrite" to replace it.`,
          success: false,
        };
      }

      // Create parent directories if needed
      const parentDir = path.dirname(resolved);
      await fs.mkdir(parentDir, { recursive: true });

      // Write the file
      await fs.writeFile(resolved, content, 'utf-8');

      const overwriteNote = mode === 'overwrite' && fileExists
        ? ' (existing file was overwritten)'
        : '';

      return {
        callId,
        content: `File written successfully: ${resolved}${overwriteNote}\nSize: ${Buffer.byteLength(content, 'utf-8')} bytes`,
        success: true,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to write file';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default writeFileTool;
