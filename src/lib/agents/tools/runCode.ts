// ============================================================================
// Built-in Tool: run_code
// ============================================================================
// Execute JavaScript or Python code in a sandboxed environment.
// JavaScript: uses Node.js vm module with timeout, no filesystem/network.
// Python: uses child_process.execFile with strict timeout.
// Disabled by default (opt-in).
// ============================================================================

import { RegisteredTool, ToolResult } from '../types';
import * as vm from 'vm';
import { execFile } from 'child_process';

/** Maximum execution time in milliseconds */
const EXECUTION_TIMEOUT = 10_000;

/** Maximum output size in characters */
const MAX_OUTPUT_SIZE = 10_000;

function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT_SIZE) {
    return output.slice(0, MAX_OUTPUT_SIZE) + `\n\n--- [truncated at ${MAX_OUTPUT_SIZE} characters] ---`;
  }
  return output;
}

async function executeJavaScript(code: string): Promise<{ output: string; error?: string }> {
  const logs: string[] = [];

  // Create a minimal sandbox with console.log capture
  const sandbox = {
    console: {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
      warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
      info: (...args: unknown[]) => logs.push('[INFO] ' + args.map(String).join(' ')),
    },
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
    require: undefined,
    process: undefined,
    __dirname: undefined,
    __filename: undefined,
  };

  try {
    const context = vm.createContext(sandbox);
    const script = new vm.Script(code, { filename: 'agent_code.js' });
    const result = script.runInContext(context, { timeout: EXECUTION_TIMEOUT });

    // Include the return value if it's meaningful
    if (result !== undefined) {
      logs.push(`=> ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`);
    }

    return { output: logs.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      output: logs.join('\n'),
      error: message,
    };
  }
}

function executePython(code: string): Promise<{ output: string; error?: string }> {
  return new Promise((resolve) => {
    // Try python3 first, then python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    const child = execFile(
      pythonCmd,
      ['-c', code],
      {
        timeout: EXECUTION_TIMEOUT,
        maxBuffer: MAX_OUTPUT_SIZE * 2,
        env: {
          ...process.env,
          // Restrict Python capabilities
          PYTHONDONTWRITEBYTECODE: '1',
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          const errMsg = error.killed
            ? `Execution timed out after ${EXECUTION_TIMEOUT / 1000}s`
            : stderr || error.message;
          resolve({
            output: stdout || '',
            error: errMsg,
          });
        } else {
          const output = stderr ? `${stdout}\n[STDERR] ${stderr}` : stdout;
          resolve({ output });
        }
      }
    );

    // Safety: kill child process on timeout (belt and suspenders)
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
      }
    }, EXECUTION_TIMEOUT + 1000);
  });
}

const runCodeTool: RegisteredTool = {
  definition: {
    name: 'run_code',
    description:
      'Execute JavaScript or Python code. JavaScript runs in a sandboxed VM with no filesystem or network access. ' +
      'Python runs as a subprocess with a strict timeout. Use console.log() for JavaScript output or print() for Python. ' +
      'This tool is for quick calculations, data transformations, and code testing.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code to execute',
        },
        language: {
          type: 'string',
          description: 'Programming language: "javascript" or "python"',
          enum: ['javascript', 'python'],
        },
      },
      required: ['code', 'language'],
    },
    // Disabled by default — opt-in only
    enabled: false,
    category: 'code',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const code = args.code as string | undefined;
    const language = args.language as string | undefined;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return {
        callId,
        content: '',
        error:
          'Parameter "code" is required and must be a non-empty string. ' +
          'Expected: run_code(code: "console.log(42)", language: "javascript"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    if (!language || !['javascript', 'python'].includes(language)) {
      return {
        callId,
        content: '',
        error:
          'Parameter "language" must be "javascript" or "python". ' +
          'Expected: run_code(code: "print(42)", language: "python"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    let result: { output: string; error?: string };

    if (language === 'javascript') {
      result = await executeJavaScript(code);
    } else {
      result = await executePython(code);
    }

    const output = truncateOutput(result.output || '(no output)');

    if (result.error) {
      return {
        callId,
        content: output ? `Output before error:\n${output}` : '',
        error: result.error,
        success: false,
      };
    }

    return {
      callId,
      content: `[${language}] Execution result:\n\n${output}`,
      success: true,
    };
  },
};

export default runCodeTool;
