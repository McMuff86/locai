// ============================================================================
// Built-in Tool: read_file
// ============================================================================
// Read a file from the user's allowed directories (documents / notes).
// Includes security checks to prevent path traversal.
// ============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { RegisteredTool, ToolResult } from '../types';
import { resolveWorkspacePath, getHomeDir } from '../../settings/store';

/** Maximum file content returned (characters) */
const MAX_FILE_SIZE = 50_000;

/**
 * Resolve allowed base directories for file reading.
 * Includes workspace path from settings, env vars, and defaults.
 */
function getAllowedPaths(): string[] {
  const paths: string[] = [];

  // Agent workspace
  const workspace = resolveWorkspacePath();
  if (workspace) paths.push(workspace);

  // Documents data path
  const dataPath = process.env.LOCAI_DATA_PATH;
  if (dataPath) paths.push(path.resolve(dataPath));

  // Notes path
  const notesPath = process.env.LOCAL_NOTES_PATH;
  if (notesPath) paths.push(path.resolve(notesPath));

  // Home-based defaults
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

const readFileTool: RegisteredTool = {
  definition: {
    name: 'read_file',
    description:
      'Read the contents of a file. Relative paths (e.g. "test.txt") ' +
      'are resolved from the agent workspace (~/.locai/workspace/). ' +
      'Can also read from documents or notes directories. Large files are truncated.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path. Relative paths are resolved from the workspace.',
        },
      },
      required: ['path'],
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

    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
      return {
        callId,
        content: '',
        error:
          'Parameter "path" is required and must be a non-empty string. ' +
          'Expected: read_file(path: "dateiname.txt"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    // Security: resolve path first, then check containment.
    // The `path.resolve` call normalises away any ".." segments,
    // so we rely on the `isPathAllowed` check below for real security.
    // We additionally reject obvious traversal attempts early.
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
      if (workspace) {
        resolved = path.resolve(workspace, filePath);
      } else {
        resolved = path.resolve(filePath);
      }
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
        error: `Access denied: file is outside allowed directories`,
        success: false,
      };
    }

    try {
      const stat = await fs.stat(resolved);

      if (stat.isDirectory()) {
        // List directory contents instead
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        const listing = entries
          .map((e) => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`)
          .join('\n');
        return {
          callId,
          content: `Directory listing of ${resolved}:\n\n${listing}`,
          success: true,
        };
      }

      const content = await fs.readFile(resolved, 'utf-8');
      const truncated = content.length > MAX_FILE_SIZE;
      const output = truncated
        ? content.slice(0, MAX_FILE_SIZE) + `\n\n--- [truncated at ${MAX_FILE_SIZE} characters] ---`
        : content;

      return {
        callId,
        content: `File: ${resolved}\nSize: ${stat.size} bytes${truncated ? ' (truncated)' : ''}\n\n${output}`,
        success: true,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to read file';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default readFileTool;
