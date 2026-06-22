import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../_utils/responses';
import { assertLocalRequest } from '../../_utils/security';
import {
  completeRunLedgerEntry,
  createRunLedgerEntry,
  listRunLedgerEntries,
} from '@/lib/workspace/store';
import { normalizeExternalAgentProvider, runExternalAgent } from '@/lib/external-agents/gateway';
import type { ExternalAgentMode } from '@/lib/external-agents/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function promptSummary(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

function normalizeMode(value: unknown): ExternalAgentMode {
  return value === 'edit' ? 'edit' : 'plan';
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
    const artifactId = request.nextUrl.searchParams.get('artifactId') || undefined;
    const runs = await listRunLedgerEntries(projectId, artifactId);
    const externalRuns = runs.filter((run) => run.toolId.startsWith('external_agent:'));
    return apiSuccess({ runs: externalRuns, count: externalRuns.length });
  } catch (err) {
    console.error('[API] GET /api/external-agents/runs error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load external agent runs', 500);
  }
}

export async function POST(request: NextRequest) {
  const denied = assertLocalRequest(request);
  if (denied) return denied;

  let ledgerId: string | null = null;

  try {
    const body = await request.json();
    const provider = normalizeExternalAgentProvider(body?.provider);
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
    const artifactId = typeof body?.artifactId === 'string' && body.artifactId ? body.artifactId : undefined;
    const mode = normalizeMode(body?.mode);
    const cwd = typeof body?.cwd === 'string' ? body.cwd : undefined;
    const timeoutSec = typeof body?.timeoutSec === 'number' ? body.timeoutSec : undefined;

    if (!prompt) return apiError('Prompt is required', 400);
    if (!projectId) return apiError('projectId is required for external agent runs', 400);

    const ledger = await createRunLedgerEntry({
      projectId,
      artifactId,
      requestSummary: promptSummary(prompt) || `External ${provider} run`,
      toolId: `external_agent:${provider}`,
      toolSource: 'external-service',
      capabilityScopes: mode === 'edit'
        ? ['read_local_files', 'write_local_files', 'shell_command', 'code_execution']
        : ['read_local_files', 'shell_command', 'code_execution'],
      approvalPolicy: 'per_call',
      approvalDecision: 'approved',
      redactedArguments: {
        provider,
        mode,
        cwd,
        timeoutSec,
        promptPreview: promptSummary(prompt),
      },
    });
    ledgerId = ledger.id;

    const result = await runExternalAgent({
      provider,
      prompt,
      cwd,
      mode,
      timeoutSec,
    });

    const completedRun = await completeRunLedgerEntry(ledger.id, {
      success: result.success,
      error: result.error,
      changedFiles: result.changedFiles,
      redactedResult: {
        provider: result.provider,
        mode: result.mode,
        cwd: result.cwd,
        command: result.command,
        args: result.args,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        stdout: result.stdout,
        stderr: result.stderr,
      },
    });

    return apiSuccess({ result, run: completedRun ?? ledger });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to run external agent';
    if (ledgerId) {
      await completeRunLedgerEntry(ledgerId, {
        success: false,
        error: message,
      }).catch(() => {});
    }
    console.error('[API] POST /api/external-agents/runs error:', err);
    return apiError(message, 400);
  }
}
