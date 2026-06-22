import { beforeEach, describe, expect, it, vi } from 'vitest';
import { codexCliTool, claudeCodeCliTool } from './externalAgent';
import { runExternalAgent } from '@/lib/external-agents/gateway';

vi.mock('@/lib/external-agents/gateway', () => ({
  runExternalAgent: vi.fn(),
}));

const runExternalAgentMock = vi.mocked(runExternalAgent);

beforeEach(() => {
  runExternalAgentMock.mockReset();
});

describe('external agent tools', () => {
  it('runs Codex CLI through the external-agent gateway', async () => {
    runExternalAgentMock.mockResolvedValue({
      provider: 'codex',
      mode: 'edit',
      cwd: 'C:\\repo',
      command: 'codex',
      args: ['exec', '--sandbox', 'workspace-write', '<prompt>'],
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      exitCode: 0,
      success: true,
      timedOut: false,
      stdout: 'done',
      stderr: '',
      changedFiles: ['src/app.ts'],
    });

    const signal = new AbortController().signal;
    const result = await codexCliTool.handler(
      {
        prompt: 'Refactor src/app.ts',
        mode: 'edit',
        cwd: 'C:\\repo',
        timeoutSec: 120,
      },
      signal,
    );

    expect(result.success).toBe(true);
    expect(result.content).toContain('Provider: codex');
    expect(result.content).toContain('Changed files: 1');
    expect(runExternalAgentMock).toHaveBeenCalledWith({
      provider: 'codex',
      prompt: 'Refactor src/app.ts',
      mode: 'edit',
      cwd: 'C:\\repo',
      timeoutSec: 120,
      signal,
    });
  });

  it('runs Claude Code CLI through the external-agent gateway', async () => {
    runExternalAgentMock.mockResolvedValue({
      provider: 'claude-code',
      mode: 'plan',
      cwd: 'C:\\repo',
      command: 'claude',
      args: ['-p', '<prompt>', '--permission-mode', 'plan'],
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      exitCode: 0,
      success: true,
      timedOut: false,
      stdout: 'plan',
      stderr: '',
      changedFiles: [],
    });

    const result = await claudeCodeCliTool.handler({ prompt: 'Plan the fix' });

    expect(result.success).toBe(true);
    expect(result.content).toContain('Provider: claude-code');
    expect(runExternalAgentMock).toHaveBeenCalledWith({
      provider: 'claude-code',
      prompt: 'Plan the fix',
      mode: undefined,
      cwd: undefined,
      timeoutSec: undefined,
      signal: undefined,
    });
  });

  it('rejects empty prompts without starting a CLI process', async () => {
    const result = await codexCliTool.handler({ prompt: '   ' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('prompt');
    expect(runExternalAgentMock).not.toHaveBeenCalled();
  });

  it('returns gateway errors as tool failures', async () => {
    runExternalAgentMock.mockRejectedValue(new Error('Disabled in settings'));

    const result = await claudeCodeCliTool.handler({ prompt: 'Implement this' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Disabled in settings');
  });
});
