import { runExternalAgent } from '@/lib/external-agents/gateway';
import type {
  ExternalAgentMode,
  ExternalAgentProvider,
  ExternalAgentRunResult,
} from '@/lib/external-agents/types';
import type { RegisteredTool, ToolResult } from '../types';

const PROVIDER_LABELS: Record<ExternalAgentProvider, string> = {
  codex: 'Codex CLI',
  'claude-code': 'Claude Code CLI',
};

function parseMode(value: unknown): ExternalAgentMode | undefined {
  if (value == null || value === '') return undefined;
  if (value === 'plan' || value === 'edit') return value;
  throw new Error('Parameter "mode" must be "plan" or "edit"');
}

function parseTimeoutSec(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Parameter "timeoutSec" must be a positive number when provided');
  }
  return value;
}

function formatExternalAgentResult(result: ExternalAgentRunResult): string {
  const lines = [
    `Provider: ${result.provider}`,
    `Mode: ${result.mode}`,
    `CWD: ${result.cwd}`,
    `Command: ${result.command} ${result.args.join(' ')}`,
    `Exit code: ${result.exitCode ?? 'none'}`,
    `Timed out: ${result.timedOut ? 'yes' : 'no'}`,
    `Changed files: ${result.changedFiles.length}`,
  ];

  if (result.changedFiles.length > 0) {
    lines.push('', 'Changed files:', ...result.changedFiles.map((file) => `- ${file}`));
  }

  if (result.stdout.trim()) {
    lines.push('', 'STDOUT:', result.stdout.trim());
  }

  if (result.stderr.trim()) {
    lines.push('', 'STDERR:', result.stderr.trim());
  }

  return lines.join('\n');
}

function createExternalAgentTool(provider: ExternalAgentProvider): RegisteredTool {
  const name = provider === 'codex' ? 'codex_cli' : 'claude_code_cli';
  const label = PROVIDER_LABELS[provider];

  return {
    definition: {
      name,
      description:
        `Run the official ${label} as an external coding agent using the user's existing CLI authentication. ` +
        'Use mode "plan" to inspect and propose changes, or mode "edit" when explicit code edits are needed. ' +
        'The working directory must be inside the configured LocAI external-agent roots.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: `Instruction to send to ${label}. Include relevant file paths, constraints, and expected output.`,
          },
          mode: {
            type: 'string',
            enum: ['plan', 'edit'],
            description: 'Execution mode. "plan" is read-only where supported; "edit" allows workspace edits.',
            default: 'plan',
          },
          cwd: {
            type: 'string',
            description:
              'Optional working directory. Must be inside the repository, configured workspace, or configured external-agent root.',
          },
          timeoutSec: {
            type: 'number',
            description: 'Optional timeout in seconds. Defaults to the external-agent setting.',
          },
        },
        required: ['prompt'],
      },
      enabled: true,
      category: 'code',
    },
    handler: async (args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult> => {
      const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
      if (!prompt) {
        return {
          callId: '',
          content: '',
          error: 'Parameter "prompt" is required and must be a non-empty string.',
          success: false,
        };
      }

      try {
        const result = await runExternalAgent({
          provider,
          prompt,
          mode: parseMode(args.mode),
          cwd: typeof args.cwd === 'string' ? args.cwd : undefined,
          timeoutSec: parseTimeoutSec(args.timeoutSec),
          signal,
        });

        return {
          callId: '',
          content: formatExternalAgentResult(result),
          error: result.error,
          success: result.success,
        };
      } catch (error) {
        return {
          callId: '',
          content: '',
          error: error instanceof Error ? error.message : `${label} failed`,
          success: false,
        };
      }
    },
  };
}

export const codexCliTool = createExternalAgentTool('codex');
export const claudeCodeCliTool = createExternalAgentTool('claude-code');

export default [codexCliTool, claudeCodeCliTool] as const;
