// ============================================================================
// Built-in Tool: run_command
// ============================================================================
// Execute shell commands in a sandboxed environment.
// Uses child_process.execFile with shell: false for security.
// Includes blocklist, metacharacter rejection, path containment,
// output truncation and timeout enforcement.
// ============================================================================

import { execFile } from 'child_process';
import path from 'path';
import { RegisteredTool, ToolResult } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters returned in stdout / stderr combined */
const MAX_OUTPUT_CHARS = 50_000;

/** Default command timeout in seconds */
const DEFAULT_TIMEOUT_S = 30;

/** Absolute maximum timeout in seconds */
const MAX_TIMEOUT_S = 120;

// ---------------------------------------------------------------------------
// Blocklist & shell-metacharacter detection
// ---------------------------------------------------------------------------

/**
 * Blocked command patterns.
 * Each entry is checked against the full reconstructed command string
 * (binary + args joined by space) so compound patterns like "rm -rf" work.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\bmkfs\b/i,
  /\bdd\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bkill\s+-9\b/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bchmod\s+777\b/i,
  /\bchown\b/i,
];

/** Shell metacharacters that must never appear in arguments (prevents injection) */
const SHELL_META_RE = /[|;&$`><]|\|\||&&|>>|\$\(|\)/;

// ---------------------------------------------------------------------------
// Allowed-path helpers (same logic as readFile.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Argument parsing – respects single & double quoted strings
// ---------------------------------------------------------------------------

/**
 * Split a command string into tokens respecting quoted substrings.
 * `"hello world"` → one token; unquoted whitespace splits tokens.
 */
function parseCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) tokens.push(current);

  return tokens;
}

// ---------------------------------------------------------------------------
// Truncation helper
// ---------------------------------------------------------------------------

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n--- [truncated at ${max} characters] ---`;
}

// ---------------------------------------------------------------------------
// Tool implementation
// ---------------------------------------------------------------------------

const runCommandTool: RegisteredTool = {
  definition: {
    name: 'run_command',
    description:
      'Execute a shell command in a sandboxed environment. ' +
      'The command runs with shell disabled (no pipes, redirects, etc.). ' +
      'Only allowed within permitted directories. ' +
      'Dangerous commands (rm -rf, sudo, etc.) are blocked.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command to execute (e.g. "ls -la", "cat file.txt")',
        },
        cwd: {
          type: 'string',
          description:
            'Working directory for the command (optional). Must be within allowed paths.',
        },
        timeout: {
          type: 'number',
          description:
            'Timeout in seconds (optional, default 30, max 120)',
        },
      },
      required: ['command'],
    },
    enabled: true,
    category: 'code',
  },

  handler: async (
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const rawCommand = args.command as string | undefined;
    const rawCwd = args.cwd as string | undefined;
    const rawTimeout = args.timeout as number | undefined;

    // --- Validate command ---------------------------------------------------

    if (!rawCommand || typeof rawCommand !== 'string' || !rawCommand.trim()) {
      return {
        callId,
        content: '',
        error:
          'Parameter "command" is required and must be a non-empty string. ' +
          'Expected: run_command(command: "ls -la"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    // --- Parse into binary + args ------------------------------------------

    const tokens = parseCommand(rawCommand.trim());
    if (tokens.length === 0) {
      return {
        callId,
        content: '',
        error: 'Could not parse command – no tokens found',
        success: false,
      };
    }

    const binary = tokens[0];
    const cmdArgs = tokens.slice(1);

    // --- Blocklist check (on full command string) --------------------------

    const fullCmd = tokens.join(' ');
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(fullCmd)) {
        return {
          callId,
          content: '',
          error: `Blocked: command matches dangerous pattern (${pattern.source})`,
          success: false,
        };
      }
    }

    // --- Shell metacharacter check on each argument ------------------------

    for (const arg of cmdArgs) {
      if (SHELL_META_RE.test(arg)) {
        return {
          callId,
          content: '',
          error: `Blocked: argument "${arg}" contains shell metacharacters. Pipes, redirects, and subshells are not allowed.`,
          success: false,
        };
      }
    }

    // --- Validate cwd (if provided) ----------------------------------------

    let resolvedCwd: string | undefined;

    if (rawCwd != null) {
      if (typeof rawCwd !== 'string' || !rawCwd.trim()) {
        return {
          callId,
          content: '',
          error: 'Parameter "cwd" must be a non-empty string when provided',
          success: false,
        };
      }

      if (rawCwd.includes('..') || rawCwd.includes('\0')) {
        return {
          callId,
          content: '',
          error: 'Path traversal ("..") or null bytes are not allowed in cwd',
          success: false,
        };
      }

      resolvedCwd = path.resolve(rawCwd);
      const allowed = getAllowedPaths();

      if (allowed.length === 0) {
        return {
          callId,
          content: '',
          error:
            'No allowed paths configured. Set LOCAI_DATA_PATH or LOCAL_NOTES_PATH.',
          success: false,
        };
      }

      if (!isPathAllowed(resolvedCwd, allowed)) {
        return {
          callId,
          content: '',
          error: `Access denied: cwd "${resolvedCwd}" is outside allowed directories`,
          success: false,
        };
      }
    }

    // --- Resolve timeout ----------------------------------------------------

    let timeoutS = DEFAULT_TIMEOUT_S;
    if (rawTimeout != null) {
      if (typeof rawTimeout !== 'number' || rawTimeout <= 0) {
        return {
          callId,
          content: '',
          error: 'Parameter "timeout" must be a positive number (seconds)',
          success: false,
        };
      }
      timeoutS = Math.min(rawTimeout, MAX_TIMEOUT_S);
    }
    const timeoutMs = timeoutS * 1000;

    // --- Execute command ----------------------------------------------------

    return new Promise<ToolResult>((resolve) => {
      const ac = new AbortController();

      // Merge external signal with our timeout-based signal
      const onExternalAbort = () => ac.abort();
      if (signal) {
        if (signal.aborted) {
          resolve({
            callId,
            content: '',
            error: 'Command aborted before execution',
            success: false,
          });
          return;
        }
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }

      const timer = setTimeout(() => ac.abort(), timeoutMs);

      const child = execFile(
        binary,
        cmdArgs,
        {
          cwd: resolvedCwd,
          timeout: timeoutMs,
          maxBuffer: MAX_OUTPUT_CHARS * 2, // generous buffer; we truncate ourselves
          shell: false,
          signal: ac.signal,
        },
        (error, stdout, stderr) => {
          clearTimeout(timer);
          if (signal) signal.removeEventListener('abort', onExternalAbort);

          // Determine exit code
          let exitCode = 0;
          if (error) {
            // node child_process error objects carry `code` for exit codes
            // and `killed` / `signal` for timeouts / signals
            exitCode =
              typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
                ? ((error as unknown as { code: number }).code)
                : 1;
          }

          // Timeout detection
          const wasAborted = ac.signal.aborted;
          const wasKilled = (error as NodeJS.ErrnoException & { killed?: boolean })?.killed;
          if (wasAborted || wasKilled) {
            resolve({
              callId,
              content: '',
              error: `Command timed out after ${timeoutS}s and was killed`,
              success: false,
            });
            return;
          }

          // Build output
          const stdoutStr = truncate((stdout || '').toString(), MAX_OUTPUT_CHARS);
          const stderrStr = truncate((stderr || '').toString(), MAX_OUTPUT_CHARS);

          const parts: string[] = [];
          parts.push(`Exit code: ${exitCode}`);
          if (stdoutStr) parts.push(`--- stdout ---\n${stdoutStr}`);
          if (stderrStr) parts.push(`--- stderr ---\n${stderrStr}`);

          const content = parts.join('\n\n');

          if (error && !wasAborted && !wasKilled) {
            resolve({
              callId,
              content,
              error: stderrStr || error.message,
              success: false,
            });
          } else {
            resolve({
              callId,
              content,
              success: true,
            });
          }
        },
      );

      // Safety net: if child can't even spawn
      child.on('error', (err) => {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onExternalAbort);
        resolve({
          callId,
          content: '',
          error: `Failed to execute command: ${err.message}`,
          success: false,
        });
      });
    });
  },
};

export default runCommandTool;
