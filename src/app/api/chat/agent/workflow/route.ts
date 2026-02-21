// ============================================================================
// Workflow Agent API Route
// ============================================================================
// POST /api/chat/agent/workflow
//
// New endpoint for the WorkflowEngine. Streams NDJSON WorkflowStreamEvents.
// The existing /api/chat/agent endpoint is NOT modified (backward compatible).
//
// Reference: docs/adr/ADR-001-workflow-engine.md
// ============================================================================

import { NextRequest } from 'next/server';
import { WorkflowEngine } from '@/lib/agents/workflow';
import { ToolRegistry } from '@/lib/agents/registry';
import { registerBuiltinTools } from '@/lib/agents/tools';
import { getRelevantMemories, formatMemories } from '@/lib/memory/store';
import { getPresetById } from '@/lib/agents/presets';
import { resolveWorkspacePath } from '@/lib/settings/store';
import type { ChatMessage, ProviderType } from '@/lib/providers/types';
import { createServerProvider, getDefaultServerProvider } from '@/lib/providers/server';
import type { WorkflowApiRequest, WorkflowPlan } from '@/lib/agents/workflowTypes';
import { WORKFLOW_DEFAULTS } from '@/lib/agents/workflowTypes';
import { apiError } from '../../../_utils/responses';

// ---------------------------------------------------------------------------
// Active Engine Registry (for REST cancel endpoint)
// ---------------------------------------------------------------------------

/** Map of workflowId → WorkflowEngine for active workflows */
export const activeEngines = new Map<string, InstanceType<typeof WorkflowEngine>>();

// ---------------------------------------------------------------------------
// Agent System Prompt (same as /api/chat/agent for consistency)
// ---------------------------------------------------------------------------

function buildDefaultAgentPrompt(enabledToolNames: string[]): string {
  const toolList = enabledToolNames.join(', ');
  const workspace = resolveWorkspacePath() || '~/.locai/workspace/';

  return (
    'Du bist ein hilfreicher KI-Agent mit Zugriff auf Werkzeuge (Tools). ' +
    'Du MUSST die bereitgestellten Werkzeuge verwenden, um Aufgaben zu erledigen. ' +
    'Schreibe KEINEN Code fuer den Benutzer zum Ausfuehren — fuehre die Aktionen selbst mit deinen Werkzeugen aus.\n\n' +
    'Verfuegbare Werkzeuge: ' + toolList + '\n\n' +
    'Wichtige Regeln:\n' +
    '- Wenn du eine Datei erstellen sollst, nutze write_file direkt.\n' +
    '- Wenn du eine Datei lesen sollst, nutze read_file direkt.\n' +
    '- Wenn du etwas suchen sollst, nutze search_documents oder web_search.\n' +
    '- Wenn du eine Notiz erstellen sollst, nutze create_note.\n' +
    '- Relative Dateipfade werden automatisch im Workspace gespeichert: ' + workspace + '\n' +
    '- Fuehre die Werkzeuge Schritt fuer Schritt aus.\n' +
    '- Antworte auf Deutsch, es sei denn der Benutzer schreibt in einer anderen Sprache.\n\n' +
    'WICHTIG:\n' +
    '- write_file braucht "path" und "content"\n' +
    '- read_file braucht "path"\n' +
    '- Fuehre Werkzeuge direkt aus.'
  );
}

function normalizeInitialPlan(
  plan: WorkflowApiRequest['initialPlan'],
  availableTools: string[],
): WorkflowPlan | undefined {
  if (!plan || typeof plan.goal !== 'string' || !Array.isArray(plan.steps)) {
    return undefined;
  }

  const steps = plan.steps
    .filter(
      (step) =>
        !!step &&
        typeof step.id === 'string' &&
        step.id.trim().length > 0 &&
        typeof step.description === 'string',
    )
    .slice(0, 32)
    .map((step) => ({
      id: step.id,
      description: step.description,
      expectedTools: Array.isArray(step.expectedTools)
        ? step.expectedTools.filter((tool) => availableTools.includes(tool))
        : [],
      dependsOn: Array.isArray(step.dependsOn)
        ? step.dependsOn.filter((dep) => typeof dep === 'string')
        : [],
      successCriteria:
        typeof step.successCriteria === 'string' && step.successCriteria.trim().length > 0
          ? step.successCriteria
          : 'Schritt erfolgreich abgeschlossen',
    }));

  if (steps.length === 0) {
    return undefined;
  }

  return {
    goal: plan.goal,
    steps,
    maxSteps:
      typeof plan.maxSteps === 'number' && plan.maxSteps > 0
        ? Math.min(plan.maxSteps, steps.length)
        : steps.length,
    createdAt: typeof plan.createdAt === 'string' ? plan.createdAt : new Date().toISOString(),
    version: typeof plan.version === 'number' ? plan.version : 1,
  };
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WorkflowApiRequest;

    const {
      message,
      model = 'llama3',
      systemPrompt,
      conversationId,
      enabledTools,
      maxSteps,
      timeoutMs = WORKFLOW_DEFAULTS.timeoutMs,
      enablePlanning = WORKFLOW_DEFAULTS.enablePlanning,
      enableReflection = WORKFLOW_DEFAULTS.enableReflection,
      host,
      conversationHistory = [],
      presetId,
      initialPlan,
    } = body;

    if (!message?.trim()) {
      return apiError('Message is required', 400);
    }

    // Set up tool registry
    const registry = new ToolRegistry();
    registerBuiltinTools(registry);

    // Determine which tools will be available
    const resolvedTools = enabledTools ?? registry.listNames();
    const resolvedInitialPlan = normalizeInitialPlan(initialPlan, resolvedTools);
    const resolvedMaxSteps =
      maxSteps ??
      (resolvedInitialPlan?.steps.length && resolvedInitialPlan.steps.length > 0
        ? resolvedInitialPlan.steps.length
        : WORKFLOW_DEFAULTS.maxSteps);

    // Build conversation messages
    // Resolve provider
    const providerType = (body as unknown as Record<string, unknown>).provider as ProviderType | undefined;
    const chatProvider = providerType && providerType !== 'ollama'
      ? createServerProvider(providerType) ?? getDefaultServerProvider()
      : createServerProvider('ollama', { baseUrl: host || undefined }) ?? getDefaultServerProvider();

    const messages: ChatMessage[] = [
      ...conversationHistory.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Inject default agent system prompt
    const defaultPrompt = buildDefaultAgentPrompt(resolvedTools);
    messages.unshift({ role: 'system', content: defaultPrompt });

    // Layer preset system prompt on top if selected
    if (presetId) {
      const preset = getPresetById(presetId);
      if (preset) {
        messages.unshift({ role: 'system', content: preset.systemPrompt });
      }
    }

    // Memory Auto-Inject
    try {
      const relevantMemories = await getRelevantMemories(message, 10);
      if (relevantMemories.length > 0) {
        messages.unshift({
          role: 'system',
          content: `Bekannte Informationen über den Benutzer:\n${formatMemories(relevantMemories)}`,
        });
      }
    } catch {
      // Memory injection is best-effort
    }

    // Flow-specific system prompt from the selected Agent node (if provided)
    if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      messages.unshift({ role: 'system', content: systemPrompt.trim() });
    }

    // Create WorkflowEngine
    const engine = new WorkflowEngine({
      message,
      messages,
      model,
      registry,
      conversationId,
      host,
      provider: chatProvider,
      initialPlan: resolvedInitialPlan,
      config: {
        enabledTools: resolvedTools,
        maxSteps: resolvedMaxSteps,
        timeoutMs,
        enablePlanning,
        enableReflection,
        maxRePlans: WORKFLOW_DEFAULTS.maxRePlans,
        stepTimeoutMs: WORKFLOW_DEFAULTS.stepTimeoutMs,
      },
    });

    // Register engine for REST cancel endpoint
    const workflowId = engine.getState().id;
    activeEngines.set(workflowId, engine);

    // Create NDJSON streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const onAbort = () => engine.cancel();
        request.signal.addEventListener('abort', onAbort);

        function emit(data: Record<string, unknown>): void {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        }

        try {
          for await (const event of engine.run()) {
            emit(event as unknown as Record<string, unknown>);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Workflow error';
          emit({ type: 'error', message: errMsg, recoverable: false });
        } finally {
          request.signal.removeEventListener('abort', onAbort);
          activeEngines.delete(workflowId);
          controller.close();
        }
      },
      cancel() {
        engine.cancel();
        activeEngines.delete(workflowId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Workflow-Mode': 'true',
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Internal server error';
    return apiError(errMsg, 500);
  }
}
