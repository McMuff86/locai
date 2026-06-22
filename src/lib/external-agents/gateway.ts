import { spawn, type SpawnOptionsWithoutStdio } from 'child_process';
import path from 'path';
import { loadServerSettings, resolveWorkspacePath, getHomeDir } from '@/lib/settings/store';
import type {
  ExternalAgentCommand,
  ExternalAgentMode,
  ExternalAgentProvider,
  ExternalAgentRunInput,
  ExternalAgentRunResult,
  ExternalAgentStatus,
} from './types';
import { EXTERNAL_AGENT_PROVIDERS } from './types';

const DEFAULT_TIMEOUT_SEC = 900;
const MAX_TIMEOUT_SEC = 3600;
const MAX_OUTPUT_CHARS = 120_000;

function now(): string {
  return new Date().toISOString();
}

function truncate(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n--- [truncated at ${max} characters] ---`;
}

function isPathInside(candidate: string, root: string): boolean {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(resolvedRoot + path.sep);
}

function getAllowedCwdRoots(): string[] {
  const settings = loadServerSettings();
  const roots = [process.cwd()];

  const workspace = resolveWorkspacePath();
  if (workspace) roots.push(workspace);

  if (settings.externalAgentDefaultCwd) roots.push(path.resolve(settings.externalAgentDefaultCwd));

  const home = getHomeDir();
  if (home) roots.push(path.resolve(home, '.locai'));

  return Array.from(new Set(roots.map((root) => path.resolve(root))));
}

export function resolveExternalAgentCwd(rawCwd?: string): string {
  const settings = loadServerSettings();
  const cwd = path.resolve(rawCwd?.trim() || settings.externalAgentDefaultCwd || process.cwd());
  const allowedRoots = getAllowedCwdRoots();

  if (!allowedRoots.some((root) => isPathInside(cwd, root))) {
    throw new Error(`External agent cwd is outside allowed roots: ${cwd}`);
  }

  return cwd;
}

function resolveMode(mode?: ExternalAgentMode): ExternalAgentMode {
  const settings = loadServerSettings();
  const candidate = mode || settings.externalAgentDefaultMode || 'plan';
  return candidate === 'edit' ? 'edit' : 'plan';
}

function resolveTimeout(timeoutSec?: number): number {
  const settings = loadServerSettings();
  const value = timeoutSec ?? settings.externalAgentTimeoutSec ?? DEFAULT_TIMEOUT_SEC;
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_SEC;
  return Math.min(Math.floor(value), MAX_TIMEOUT_SEC);
}

function getExecutable(provider: ExternalAgentProvider): string {
  const settings = loadServerSettings();
  if (provider === 'codex') return settings.codexCliPath?.trim() || 'codex';
  return settings.claudeCodePath?.trim() || 'claude';
}

function isProviderEnabled(provider: ExternalAgentProvider): boolean {
  const settings = loadServerSettings();
  if (provider === 'codex') return settings.codexCliEnabled;
  return settings.claudeCodeEnabled;
}

export function normalizeExternalAgentProvider(value: unknown): ExternalAgentProvider {
  if (typeof value === 'string' && EXTERNAL_AGENT_PROVIDERS.includes(value as ExternalAgentProvider)) {
    return value as ExternalAgentProvider;
  }
  throw new Error('Invalid external agent provider');
}

export function buildExternalAgentCommand(input: {
  provider: ExternalAgentProvider;
  prompt: string;
  mode?: ExternalAgentMode;
}): ExternalAgentCommand {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error('Prompt is required');

  const executable = getExecutable(input.provider);
  const mode = resolveMode(input.mode);

  if (input.provider === 'codex') {
    const sandbox = mode === 'edit' ? 'workspace-write' : 'read-only';
    const args = [
      'exec',
      '--sandbox',
      sandbox,
      '--ask-for-approval',
      'never',
      prompt,
    ];
    return {
      executable,
      args,
      displayArgs: [...args.slice(0, -1), '<prompt>'],
    };
  }

  const permissionMode = mode === 'edit' ? 'acceptEdits' : 'plan';
  const args = [
    '-p',
    prompt,
    '--output-format',
    'text',
    '--permission-mode',
    permissionMode,
  ];

  return {
    executable,
    args,
    displayArgs: ['-p', '<prompt>', '--output-format', 'text', '--permission-mode', permissionMode],
  };
}

function buildProcessEnv(): NodeJS.ProcessEnv {
  const keys = [
    'PATH',
    'Path',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'SystemRoot',
    'WINDIR',
    'ComSpec',
    'TEMP',
    'TMP',
    'CODEX_HOME',
    'CODEX_SQLITE_HOME',
    'CLAUDE_CONFIG_DIR',
    'CODEX_CA_CERTIFICATE',
    'SSL_CERT_FILE',
  ];
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
  for (const key of keys) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

function shouldUseWindowsShell(executable: string): boolean {
  if (process.platform !== 'win32') return false;
  if (path.isAbsolute(executable) && !/\.(cmd|bat)$/i.test(executable)) return false;
  return true;
}

function runProcess(input: {
  executable: string;
  args: string[];
  cwd: string;
  timeoutSec: number;
}): Promise<{
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const options: SpawnOptionsWithoutStdio = {
      cwd: input.cwd,
      env: buildProcessEnv(),
      shell: shouldUseWindowsShell(input.executable),
      windowsHide: true,
    };
    const child = spawn(input.executable, input.args, options);

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const finish = (result: {
      exitCode: number | null;
      error?: string;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...result,
        timedOut,
        stdout: truncate(stdout),
        stderr: truncate(stderr),
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, 3000).unref();
    }, input.timeoutSec * 1000);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = truncate(stdout + chunk.toString());
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = truncate(stderr + chunk.toString());
    });
    child.on('error', (error) => {
      finish({ exitCode: null, error: error.message });
    });
    child.on('close', (code) => {
      finish({
        exitCode: code,
        error: timedOut ? `External agent timed out after ${input.timeoutSec}s` : undefined,
      });
    });
  });
}

async function gitChangedFiles(cwd: string): Promise<string[]> {
  const result = await runProcess({
    executable: 'git',
    args: ['-C', cwd, 'status', '--short'],
    cwd,
    timeoutSec: 10,
  });
  if (result.exitCode !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^..?\s+/, '').trim())
    .filter(Boolean);
}

export async function getExternalAgentStatus(
  provider: ExternalAgentProvider,
): Promise<ExternalAgentStatus> {
  const executable = getExecutable(provider);
  const enabled = isProviderEnabled(provider);

  if (!enabled) {
    return {
      provider,
      enabled,
      executable,
      available: false,
      error: 'Disabled in settings',
    };
  }

  const result = await runProcess({
    executable,
    args: ['--version'],
    cwd: process.cwd(),
    timeoutSec: 5,
  });

  const output = (result.stdout || result.stderr).trim();
  return {
    provider,
    enabled,
    executable,
    available: result.exitCode === 0,
    version: result.exitCode === 0 ? output.split(/\r?\n/)[0] : undefined,
    error: result.exitCode === 0 ? undefined : result.error || output || 'Executable not available',
  };
}

export async function getExternalAgentStatuses(): Promise<Record<ExternalAgentProvider, ExternalAgentStatus>> {
  const entries = await Promise.all(EXTERNAL_AGENT_PROVIDERS.map(async (provider) => {
    const status = await getExternalAgentStatus(provider);
    return [provider, status] as const;
  }));
  return Object.fromEntries(entries) as Record<ExternalAgentProvider, ExternalAgentStatus>;
}

export async function runExternalAgent(input: ExternalAgentRunInput): Promise<ExternalAgentRunResult> {
  const provider = normalizeExternalAgentProvider(input.provider);
  if (!isProviderEnabled(provider)) {
    throw new Error(`${provider} external agent is disabled in settings`);
  }

  const mode = resolveMode(input.mode);
  const cwd = resolveExternalAgentCwd(input.cwd);
  const timeoutSec = resolveTimeout(input.timeoutSec);
  const command = buildExternalAgentCommand({
    provider,
    prompt: input.prompt,
    mode,
  });
  const startedAt = now();

  const processResult = await runProcess({
    executable: command.executable,
    args: command.args,
    cwd,
    timeoutSec,
  });

  const changedFiles = await gitChangedFiles(cwd);
  const completedAt = now();
  const success = processResult.exitCode === 0 && !processResult.timedOut && !processResult.error;

  return {
    provider,
    mode,
    cwd,
    command: command.executable,
    args: command.displayArgs,
    startedAt,
    completedAt,
    exitCode: processResult.exitCode,
    success,
    timedOut: processResult.timedOut,
    stdout: processResult.stdout,
    stderr: processResult.stderr,
    changedFiles,
    error: success ? undefined : processResult.error || processResult.stderr || 'External agent failed',
  };
}
