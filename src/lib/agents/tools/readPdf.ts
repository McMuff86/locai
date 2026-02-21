// ============================================================================
// Built-in Tool: read_pdf
// ============================================================================
// Extract text content from a PDF file using pdf-parse (server-side).
// Includes security checks to prevent path traversal.
// ============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { RegisteredTool, ToolResult } from '../types';
import { resolveWorkspacePath, getHomeDir } from '../../settings/store';

/** Maximum text content returned (characters) */
const MAX_TEXT_SIZE = 50_000;

function getAllowedPaths(): string[] {
  const paths: string[] = [];

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

const readPdfTool: RegisteredTool = {
  definition: {
    name: 'read_pdf',
    description:
      'Extract text content from a PDF file. Relative paths (e.g. "report.pdf") ' +
      'are resolved from the agent workspace (~/.locai/workspace/). ' +
      'Optionally extract text from a specific page only.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'PDF file path. Relative paths are resolved from the workspace.',
        },
        page: {
          type: 'integer',
          description: 'Optional 1-based page number to extract text from a specific page only.',
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
    const pageNumber = args.page as number | undefined;

    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
      return {
        callId,
        content: '',
        error:
          'Parameter "path" is required and must be a non-empty string. ' +
          'Expected: read_pdf(path: "document.pdf"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    if (filePath.includes('..') || filePath.includes('\0')) {
      return {
        callId,
        content: '',
        error: 'Path traversal ("..") or null bytes are not allowed',
        success: false,
      };
    }

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
        error: 'No allowed file paths configured. Check agent workspace settings.',
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

    const ext = path.extname(resolved).toLowerCase();
    if (ext !== '.pdf') {
      return {
        callId,
        content: '',
        error: `File is not a PDF (extension: ${ext}). Use read_file for non-PDF files.`,
        success: false,
      };
    }

    try {
      const stat = await fs.stat(resolved);

      if (stat.isDirectory()) {
        return {
          callId,
          content: '',
          error: 'Path points to a directory, not a file',
          success: false,
        };
      }

      const buffer = await fs.readFile(resolved);

      const { PDFParse } = await import('pdf-parse');
      const pdf = new PDFParse({ data: buffer });

      let text: string;
      let pageCount: number;

      if (pageNumber && pageNumber > 0) {
        // Get total page count first
        const info = await pdf.getInfo();
        pageCount = info.total;

        if (pageNumber > pageCount) {
          await pdf.destroy();
          return {
            callId,
            content: '',
            error: `Page ${pageNumber} does not exist. The PDF has ${pageCount} pages.`,
            success: false,
          };
        }

        // Extract text from the specific page only
        const result = await pdf.getText({ partial: [pageNumber] });
        text = result.text;
      } else {
        const result = await pdf.getText();
        text = result.text;
        pageCount = result.total;
      }

      await pdf.destroy();

      const truncated = text.length > MAX_TEXT_SIZE;
      const output = truncated
        ? text.slice(0, MAX_TEXT_SIZE) + `\n\n--- [truncated at ${MAX_TEXT_SIZE} characters] ---`
        : text;

      const header = pageNumber
        ? `File: ${resolved}\nPages: ${pageCount}\nExtracted: page ${pageNumber}\nSize: ${stat.size} bytes${truncated ? ' (truncated)' : ''}`
        : `File: ${resolved}\nPages: ${pageCount}\nSize: ${stat.size} bytes${truncated ? ' (truncated)' : ''}`;

      return {
        callId,
        content: `${header}\n\n${output}`,
        success: true,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to read PDF';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default readPdfTool;
