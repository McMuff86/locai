import path from 'path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/settings/store', () => ({
  loadServerSettings: () => ({
    codexCliEnabled: true,
    codexCliPath: 'codex',
    claudeCodeEnabled: true,
    claudeCodePath: 'claude',
    externalAgentDefaultCwd: '',
    externalAgentDefaultMode: 'plan',
    externalAgentTimeoutSec: 900,
  }),
  resolveWorkspacePath: () => path.join(process.cwd(), '.locai-test-workspace'),
  getHomeDir: () => process.cwd(),
}));

import {
  buildExternalAgentCommand,
  normalizeExternalAgentProvider,
  resolveExternalAgentCwd,
} from './gateway';

describe('external agent gateway', () => {
  it('builds a read-only Codex exec command for plan mode', () => {
    const command = buildExternalAgentCommand({
      provider: 'codex',
      mode: 'plan',
      prompt: 'Review this repository',
    });

    expect(command.executable).toBe('codex');
    expect(command.args).toEqual([
      'exec',
      '--sandbox',
      'read-only',
      '--ask-for-approval',
      'never',
      'Review this repository',
    ]);
    expect(command.displayArgs.at(-1)).toBe('<prompt>');
  });

  it('builds a Claude Code print command for edit mode', () => {
    const command = buildExternalAgentCommand({
      provider: 'claude-code',
      mode: 'edit',
      prompt: 'Fix the failing tests',
    });

    expect(command.executable).toBe('claude');
    expect(command.args).toEqual([
      '-p',
      'Fix the failing tests',
      '--output-format',
      'text',
      '--permission-mode',
      'acceptEdits',
    ]);
  });

  it('normalizes supported providers only', () => {
    expect(normalizeExternalAgentProvider('codex')).toBe('codex');
    expect(normalizeExternalAgentProvider('claude-code')).toBe('claude-code');
    expect(() => normalizeExternalAgentProvider('other')).toThrow('Invalid external agent provider');
  });

  it('resolves the current repository as the default allowed cwd', () => {
    expect(resolveExternalAgentCwd()).toBe(path.resolve(process.cwd()));
  });
});
