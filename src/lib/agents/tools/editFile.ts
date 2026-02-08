// ============================================================================
// Built-in Tool: edit_file
// ============================================================================
// Surgical search-and-replace editing of files in allowed directories.
// Replaces exactly one occurrence of old_text with new_text.
// Returns context around the change (3 lines before/after).
// ============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { RegisteredTool, ToolResult } from '../types';

/** Number of context lines to show before/after the edit */
const CONTEXT_LINES = 3;

/**
 * Resolve allowed base directories for file editing.
 * Same logic as readFile / writeFile.
 */
function getAllowedPaths(): string[] {
  const paths: string[] = [];

  const dataPath = process.env.LOCAI_DATA_PATH;
  if (dataPath) paths.push(path.resolve(dataPath));

  const notesPath = process.env.LOCAL_NOTES_PATH;
  if (notesPath) paths.push(path.resolve(notesPath));

  const home = process.env.HOME || process.env.USERPROFILE || '';
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

/**
 * Extract context lines around a character position in the full text.
 * Returns `CONTEXT_LINES` lines before and after the replacement.
 */
function getEditContext(
  newContent: string,
  replacementStart: number,
  newText: string,
): string {
  const lines = newContent.split('\n');

  // Find the line number where the replacement starts
  let charCount = 0;
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    // +1 for the newline character
    if (charCount + lines[i].length + 1 > replacementStart) {
      startLine = i;
      break;
    }
    charCount += lines[i].length + 1;
  }

  // Find the line number where the replacement ends
  const replacementEnd = replacementStart + newText.length;
  charCount = 0;
  let endLine = startLine;
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length + 1 > replacementEnd) {
      endLine = i;
      break;
    }
    charCount += lines[i].length + 1;
  }

  const contextStart = Math.max(0, startLine - CONTEXT_LINES);
  const contextEnd = Math.min(lines.length - 1, endLine + CONTEXT_LINES);

  const contextLines: string[] = [];
  for (let i = contextStart; i <= contextEnd; i++) {
    const prefix = i >= startLine && i <= endLine ? '» ' : '  ';
    contextLines.push(`${String(i + 1).padStart(4)} ${prefix}${lines[i]}`);
  }

  return contextLines.join('\n');
}

const editFileTool: RegisteredTool = {
  definition: {
    name: 'edit_file',
    description:
      'Make a surgical text replacement in a file. ' +
      'Finds exactly one occurrence of old_text and replaces it with new_text. ' +
      'Fails if old_text is not found or appears more than once. ' +
      'Only files within allowed directories can be edited.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative file path to edit',
        },
        old_text: {
          type: 'string',
          description: 'Exact text to find (case-sensitive, must appear exactly once)',
        },
        new_text: {
          type: 'string',
          description: 'Replacement text',
        },
      },
      required: ['path', 'old_text', 'new_text'],
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
    const oldText = args.old_text as string | undefined;
    const newText = args.new_text as string | undefined;

    // --- Parameter validation ---

    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
      return {
        callId,
        content: '',
        error: 'Parameter "path" is required and must be a non-empty string',
        success: false,
      };
    }

    if (oldText === undefined || oldText === null || typeof oldText !== 'string') {
      return {
        callId,
        content: '',
        error: 'Parameter "old_text" is required and must be a string',
        success: false,
      };
    }

    if (oldText.length === 0) {
      return {
        callId,
        content: '',
        error: 'Parameter "old_text" must not be empty',
        success: false,
      };
    }

    if (newText === undefined || newText === null || typeof newText !== 'string') {
      return {
        callId,
        content: '',
        error: 'Parameter "new_text" is required and must be a string',
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

    const resolved = path.resolve(filePath);
    const allowed = getAllowedPaths();

    if (allowed.length === 0) {
      return {
        callId,
        content: '',
        error:
          'No allowed file paths configured. Set LOCAI_DATA_PATH or LOCAL_NOTES_PATH.',
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

    // --- Edit logic ---

    try {
      const originalContent = await fs.readFile(resolved, 'utf-8');

      // Count occurrences of old_text
      let count = 0;
      let searchPos = 0;
      while (true) {
        const idx = originalContent.indexOf(oldText, searchPos);
        if (idx === -1) break;
        count++;
        searchPos = idx + 1;
      }

      if (count === 0) {
        return {
          callId,
          content: '',
          error: 'old_text not found in file. Make sure it matches exactly (case-sensitive, including whitespace).',
          success: false,
        };
      }

      if (count > 1) {
        return {
          callId,
          content: '',
          error: `old_text found ${count} times in file. It must appear exactly once for a safe replacement. Use a more specific/longer text snippet.`,
          success: false,
        };
      }

      // Perform the replacement
      const matchIndex = originalContent.indexOf(oldText);
      const newContent =
        originalContent.slice(0, matchIndex) +
        newText +
        originalContent.slice(matchIndex + oldText.length);

      await fs.writeFile(resolved, newContent, 'utf-8');

      const context = getEditContext(newContent, matchIndex, newText);

      return {
        callId,
        content: `File edited successfully: ${resolved}\n\nContext around change:\n${context}`,
        success: true,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to edit file';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default editFileTool;
