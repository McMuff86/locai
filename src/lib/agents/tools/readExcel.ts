// ============================================================================
// Built-in Tool: read_excel
// ============================================================================
// Extract content from Excel files (.xlsx, .xls, .csv) using the xlsx library.
// Includes security checks to prevent path traversal.
// ============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { RegisteredTool, ToolResult } from '../types';
import { resolveWorkspacePath, getHomeDir } from '../../settings/store';

/** Maximum text content returned (characters) */
const MAX_TEXT_SIZE = 50_000;

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv', '.ods']);

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

const readExcelTool: RegisteredTool = {
  definition: {
    name: 'read_excel',
    description:
      'Extract content from an Excel spreadsheet (.xlsx, .xls, .csv, .ods). ' +
      'Relative paths (e.g. "data.xlsx") are resolved from the agent workspace (~/.locai/workspace/). ' +
      'Returns all sheets as formatted text by default, or a specific sheet by name.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Excel file path. Relative paths are resolved from the workspace.',
        },
        sheet: {
          type: 'string',
          description: 'Optional sheet name to extract. If omitted, all sheets are returned.',
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
    const sheetName = args.sheet as string | undefined;

    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
      return {
        callId,
        content: '',
        error:
          'Parameter "path" is required and must be a non-empty string. ' +
          'Expected: read_excel(path: "data.xlsx"). ' +
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
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return {
        callId,
        content: '',
        error: `File is not a spreadsheet (extension: ${ext}). Supported: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
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

      // Dynamic import to keep xlsx server-side only
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const sheetNames = workbook.SheetNames;

      if (sheetName && !sheetNames.includes(sheetName)) {
        return {
          callId,
          content: '',
          error: `Sheet "${sheetName}" not found. Available sheets: ${sheetNames.join(', ')}`,
          success: false,
        };
      }

      const sheetsToProcess = sheetName ? [sheetName] : sheetNames;
      const parts: string[] = [];

      for (const name of sheetsToProcess) {
        const sheet = workbook.Sheets[name];
        if (!sheet) continue;

        // Convert to CSV for readable text output
        const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' });

        // Get dimensions
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const rows = range.e.r - range.s.r + 1;
        const cols = range.e.c - range.s.c + 1;

        parts.push(
          `=== Sheet: ${name} (${rows} rows x ${cols} cols) ===\n${csv}`,
        );
      }

      const text = parts.join('\n\n');
      const truncated = text.length > MAX_TEXT_SIZE;
      const output = truncated
        ? text.slice(0, MAX_TEXT_SIZE) + `\n\n--- [truncated at ${MAX_TEXT_SIZE} characters] ---`
        : text;

      const header =
        `File: ${resolved}\n` +
        `Sheets: ${sheetNames.join(', ')} (${sheetNames.length} total)\n` +
        `Size: ${stat.size} bytes` +
        (truncated ? ' (truncated)' : '');

      return {
        callId,
        content: `${header}\n\n${output}`,
        success: true,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to read Excel file';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default readExcelTool;
