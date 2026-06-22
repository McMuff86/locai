export const EXTERNAL_AGENT_PROVIDERS = ['codex', 'claude-code'] as const;

export type ExternalAgentProvider = (typeof EXTERNAL_AGENT_PROVIDERS)[number];

export type ExternalAgentMode = 'plan' | 'edit';

export interface ExternalAgentStatus {
  provider: ExternalAgentProvider;
  enabled: boolean;
  executable: string;
  available: boolean;
  version?: string;
  error?: string;
}

export interface ExternalAgentRunInput {
  provider: ExternalAgentProvider;
  prompt: string;
  cwd?: string;
  mode?: ExternalAgentMode;
  timeoutSec?: number;
}

export interface ExternalAgentRunResult {
  provider: ExternalAgentProvider;
  mode: ExternalAgentMode;
  cwd: string;
  command: string;
  args: string[];
  startedAt: string;
  completedAt: string;
  exitCode: number | null;
  success: boolean;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  changedFiles: string[];
  error?: string;
}

export interface ExternalAgentCommand {
  executable: string;
  args: string[];
  displayArgs: string[];
}
