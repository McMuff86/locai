// ============================================================================
// WorkflowEngine – Multi-Step Agent Workflow
// ============================================================================
// Implements the structured Workflow State Machine over the existing
// executeAgentLoop(). Does NOT modify executor.ts.
//
// State Machine:
//   idle → planning → executing → reflecting → done
//                  ↑              ↓
//                  └── adjust_plan ┘
//
// Reference: docs/adr/ADR-001-workflow-engine.md
// ============================================================================

import { executeAgentLoop, AgentLoopParams } from './executor';
import { ToolRegistry } from './registry';
import type { ChatProvider, ChatMessage } from '../providers/types';
import {
  WorkflowStatus,
  WorkflowPlan,
  WorkflowPlanStep,
  WorkflowStep,
  WorkflowStepReflection,
  WorkflowToolCall,
  WorkflowToolResult,
  WorkflowState,
  WorkflowConfig,
  WorkflowStreamEvent,
  WorkflowLogEvent,
  WORKFLOW_DEFAULTS,
} from './workflowTypes';
import { DagScheduler } from './dagScheduler';
import { AsyncEventChannel } from './asyncEventChannel';

// ---------------------------------------------------------------------------
// WorkflowEngine Options
// ---------------------------------------------------------------------------

export interface WorkflowEngineOptions {
  /** User message that starts the workflow */
  message: string;
  /** Conversation history (system prompts + prior messages) */
  messages: ChatMessage[];
  /** Model to use */
  model: string;
  /** Tool registry */
  registry: ToolRegistry;
  /** Chat provider to use */
  provider: ChatProvider;
  /** Workflow configuration (merged with WORKFLOW_DEFAULTS) */
  config?: Partial<WorkflowConfig>;
  /** Conversation ID for state tracking */
  conversationId?: string;
  /** Optional externally compiled plan (e.g. visual flow) */
  initialPlan?: WorkflowPlan;
  /** Ollama host override (deprecated — use provider) */
  host?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let workflowCounter = 0;

function makeWorkflowId(): string {
  workflowCounter += 1;
  return `wf_${Date.now()}_${workflowCounter}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Structured Planning Prompt
// ---------------------------------------------------------------------------

const PLANNING_SYSTEM_PROMPT = `Du bist ein präziser Planer. Erstelle einen strukturierten Ausführungsplan als JSON.
Antworte NUR mit validem JSON, ohne Markdown-Codeblöcke, ohne Erklärungen.

JSON-Format:
{
  "goal": "Das zu erreichende Ziel in einem Satz",
  "steps": [
    {
      "id": "step-1",
      "description": "Was in diesem Schritt getan wird",
      "expectedTools": ["tool_name"],
      "dependsOn": [],
      "successCriteria": "Woran ich erkenne, dass dieser Schritt erfolgreich war"
    }
  ],
  "maxSteps": 5
}

Regeln:
- Maximal 5 Schritte (keine Redundanz)
- expectedTools nur aus verfügbaren Tools wählen
- dependsOn: IDs von Steps die zuerst fertig sein müssen (leer wenn keine Abhängigkeit)
- Kein Schritt "Zusammenfassen" oder "Antwort erstellen" – das passiert automatisch`;

// ---------------------------------------------------------------------------
// Reflection Prompt
// ---------------------------------------------------------------------------

function buildReflectionPrompt(
  step: WorkflowStep,
  remainingSteps: WorkflowPlanStep[],
): string {
  const toolSummary = step.toolResults
    .map((r) => `  - ${r.success ? '✅' : '❌'} ${r.callId}: ${r.content.slice(0, 200)}`)
    .join('\n');

  const remaining = remainingSteps.map((s) => `  - ${s.id}: ${s.description}`).join('\n');

  return (
    `Schritt "${step.description}" wurde ausgeführt.\n\n` +
    `Tool-Ergebnisse:\n${toolSummary || '  (keine Tools verwendet)'}\n\n` +
    `Verbleibende geplante Schritte:\n${remaining || '  (keine weiteren Schritte)'}\n\n` +
    `Bewerte das Ergebnis als JSON (NUR JSON, kein Markdown):\n` +
    `{\n` +
    `  "assessment": "success|partial|failure",\n` +
    `  "nextAction": "continue|adjust_plan|complete|abort",\n` +
    `  "comment": "Kurze Erklärung (max 1 Satz)",\n` +
    `  "finalAnswer": null,\n` +
    `  "planAdjustment": null\n` +
    `}\n\n` +
    `Wähle "complete" NUR wenn du das Ziel bereits vollständig erreicht hast.\n` +
    `Wähle "adjust_plan" wenn der Plan angepasst werden muss (selten).\n` +
    `Wähle "continue" um mit dem nächsten geplanten Schritt fortzufahren.\n` +
    `Wähle "abort" nur bei einem nicht behebbaren Fehler.`
  );
}

// ---------------------------------------------------------------------------
// JSON Parsing Helpers
// ---------------------------------------------------------------------------

function tryParseJson<T>(text: string): T | null {
  // Strip markdown code fences if present
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Try to find JSON object in the text
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function parsePlan(text: string, availableTools: string[]): WorkflowPlan | null {
  interface RawPlan {
    goal?: string;
    steps?: Array<{
      id?: string;
      description?: string;
      expectedTools?: string[];
      dependsOn?: string[];
      successCriteria?: string;
    }>;
    maxSteps?: number;
  }

  const raw = tryParseJson<RawPlan>(text);
  if (!raw || !raw.goal || !Array.isArray(raw.steps)) {
    return null;
  }

  const steps: WorkflowPlanStep[] = raw.steps.slice(0, 8).map((s, i) => ({
    id: s.id ?? `step-${i + 1}`,
    description: s.description ?? `Schritt ${i + 1}`,
    expectedTools: (s.expectedTools ?? []).filter((t) => availableTools.includes(t)),
    dependsOn: s.dependsOn ?? [],
    successCriteria: s.successCriteria ?? 'Tool-Ausführung erfolgreich',
  }));

  return {
    goal: raw.goal,
    steps,
    maxSteps: typeof raw.maxSteps === 'number' ? Math.min(raw.maxSteps, 8) : steps.length,
    createdAt: nowIso(),
    version: 1,
  };
}

function parseReflection(text: string): WorkflowStepReflection | null {
  interface RawReflection {
    assessment?: string;
    nextAction?: string;
    comment?: string;
    finalAnswer?: string | null;
    planAdjustment?: WorkflowStepReflection['planAdjustment'] | null;
    abortReason?: string;
  }

  const raw = tryParseJson<RawReflection>(text);
  if (!raw || !raw.assessment || !raw.nextAction) {
    return null;
  }

  const validAssessments = ['success', 'partial', 'failure'] as const;
  const validNextActions = ['continue', 'adjust_plan', 'complete', 'abort'] as const;

  const assessment = validAssessments.includes(raw.assessment as (typeof validAssessments)[number])
    ? (raw.assessment as WorkflowStepReflection['assessment'])
    : 'partial';

  const nextAction = validNextActions.includes(raw.nextAction as (typeof validNextActions)[number])
    ? (raw.nextAction as WorkflowStepReflection['nextAction'])
    : 'continue';

  return {
    assessment,
    nextAction,
    comment: raw.comment ?? undefined,
    finalAnswer: raw.finalAnswer ?? undefined,
    planAdjustment: raw.planAdjustment ?? undefined,
    abortReason: raw.abortReason ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// WorkflowEngine Class
// ---------------------------------------------------------------------------

export class WorkflowEngine {
  private state: WorkflowState;
  private config: WorkflowConfig;
  private messages: ChatMessage[];
  private registry: ToolRegistry;
  private provider: ChatProvider;
  private abortController: AbortController;
  private logBuffer: WorkflowLogEvent[] = [];

  constructor(options: WorkflowEngineOptions) {
    const {
      message,
      messages,
      model,
      registry,
      provider,
      config: configOverrides = {},
      conversationId,
    } = options;

    this.registry = registry;
    this.messages = messages;
    this.provider = provider;
    this.abortController = new AbortController();

    // Merge config with defaults
    this.config = {
      model,
      enabledTools: registry.listNames(),
      host: options.host,
      ...WORKFLOW_DEFAULTS,
      ...configOverrides,
    };

    // Initial state
    this.state = {
      id: makeWorkflowId(),
      conversationId,
      status: 'idle',
      userMessage: message,
      plan: options.initialPlan ?? null,
      steps: [],
      currentStepIndex: 0,
      replanCount: 0,
      config: this.config,
      startedAt: nowIso(),
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  getState(): WorkflowState {
    return { ...this.state };
  }

  cancel(): void {
    this.abortController.abort();
    this.transition('cancelled');
  }

  /**
   * Run the workflow. Yields WorkflowStreamEvent objects for streaming.
   */
  async *run(): AsyncGenerator<WorkflowStreamEvent> {
    const startedAt = Date.now();

    // Set up global timeout
    const globalTimeoutSec = (this.config.timeoutMs / 1000).toFixed(0);
    const stepTimeoutSec = (this.config.stepTimeoutMs / 1000).toFixed(0);
    console.log(`[Workflow] 🚀 Workflow started (global timeout: ${globalTimeoutSec}s, step timeout: ${stepTimeoutSec}s, model: ${this.config.model})`);
    yield this.makeLog('info', `Workflow started (global timeout: ${globalTimeoutSec}s, step timeout: ${stepTimeoutSec}s, model: ${this.config.model})`);
    const timeoutId = setTimeout(() => {
      console.error(`[Workflow] ⏰ GLOBAL TIMEOUT after ${globalTimeoutSec}s — aborting workflow`);
      this.bufferLog('error', `GLOBAL TIMEOUT after ${globalTimeoutSec}s — aborting workflow`);
      this.abortController.abort();
      this.transition('timeout');
    }, this.config.timeoutMs);

    try {
      yield this.emit({
        type: 'workflow_start',
        workflowId: this.state.id,
        timestamp: nowIso(),
        config: {
          maxSteps: this.config.maxSteps,
          enabledTools: this.config.enabledTools,
        },
      });

      this.transition('planning');

      // -----------------------------------------------------------------------
      // Phase 1: Planning
      // -----------------------------------------------------------------------
      if (this.config.enablePlanning) {
        yield* this.runPlanningPhase(false);
        if (this.isAborted()) {
          yield* this.finalize(startedAt);
          return;
        }
      }

      // If planning failed or was skipped, create a minimal plan
      if (!this.state.plan) {
        this.state.plan = this.createFallbackPlan();
      }

      const currentPlan = this.state.plan;
      yield this.emit({
        type: 'plan' as const,
        plan: currentPlan,
        isAdjustment: false,
      });

      this.transition('executing');

      // -----------------------------------------------------------------------
      // Phase 2: Execute Steps (DAG-based parallel execution)
      // -----------------------------------------------------------------------
      const allPlanSteps = [...this.state.plan.steps];
      const useParallelExecution = this.config.enableParallelExecution !== false;

      if (useParallelExecution) {
        yield* this.executeDag(allPlanSteps);
      } else {
        yield* this.executeLinear(allPlanSteps);
      }

      // -----------------------------------------------------------------------
      // Phase 4: Final Answer (if not done via early exit)
      // -----------------------------------------------------------------------
      if (this.state.status !== 'done' && this.state.status !== 'error' && !this.isAborted()) {
        this.transition('done');

        const finalAnswer = await this.generateFinalAnswer();
        yield* this.drainLogBuffer();

        // Build the effective answer, falling back to a summary of tool results
        const effectiveAnswer = finalAnswer?.trim()
          || this.buildFallbackAnswer()
          || 'Workflow abgeschlossen.';

        this.state.finalAnswer = effectiveAnswer;
        yield this.makeLog(
          finalAnswer ? 'info' : 'warn',
          finalAnswer
            ? `Final answer ready (${finalAnswer.length} chars)`
            : 'Final answer was empty — using fallback',
        );
        yield this.emit({
          type: 'message',
          content: effectiveAnswer,
          done: true,
        });
      }
    } catch (err) {
      if (!this.isAborted()) {
        const msg = err instanceof Error ? err.message : 'Workflow-Fehler';
        this.state.errorMessage = msg;
        this.transition('error');
        yield this.emit({
          type: 'error',
          message: msg,
          recoverable: false,
        });
      }
    } finally {
      clearTimeout(timeoutId);
    }

    yield* this.finalize(startedAt);
  }

  // -------------------------------------------------------------------------
  // Private: DAG Execution
  // -------------------------------------------------------------------------

  private async *executeDag(allPlanSteps: WorkflowPlanStep[]): AsyncGenerator<WorkflowStreamEvent> {
    const scheduler = new DagScheduler(allPlanSteps);
    const conditionResults = new Map<string, boolean>();
    let stepExecutionIndex = 0;

    while (!scheduler.isFinished() && !this.isAborted()) {
      const ready = scheduler.getReadySteps();

      if (ready.length === 0 && scheduler.getRunningCount() === 0) {
        // No steps ready and nothing running — deadlock or all done
        break;
      }

      // Skip steps in non-taken branches
      const toExecute: string[] = [];
      for (const id of ready) {
        if (scheduler.shouldSkip(id, conditionResults)) {
          scheduler.markSkipped(id);
          yield this.emit({
            type: 'step_skipped',
            stepId: id,
            reason: 'Branch nicht genommen',
          });
          continue;
        }
        toExecute.push(id);
      }

      if (toExecute.length === 0) {
        // All ready steps were skipped, re-check
        continue;
      }

      // Execute steps (parallel if multiple are ready)
      if (toExecute.length === 1) {
        // Single step — execute directly (no channel overhead)
        const stepId = toExecute[0];
        scheduler.markRunning(stepId);
        yield* this.executeSingleDagStep(
          stepId,
          allPlanSteps,
          scheduler,
          conditionResults,
          stepExecutionIndex++,
        );
      } else {
        // Multiple steps ready — execute in parallel via channel
        const channel = new AsyncEventChannel<WorkflowStreamEvent>();
        let pendingCount = toExecute.length;

        for (const stepId of toExecute) {
          scheduler.markRunning(stepId);
          const idx = stepExecutionIndex++;

          // Fire-and-forget async execution
          void this.executeParallelDagStep(
            stepId,
            allPlanSteps,
            scheduler,
            conditionResults,
            idx,
            channel,
          ).finally(() => {
            pendingCount--;
            if (pendingCount === 0) {
              channel.close();
            }
          });
        }

        // Yield events as they arrive from parallel steps
        for await (const event of channel) {
          yield event;
          if (this.isAborted()) break;
        }
      }
    }
  }

  private async *executeSingleDagStep(
    stepId: string,
    allPlanSteps: WorkflowPlanStep[],
    scheduler: DagScheduler,
    conditionResults: Map<string, boolean>,
    executionIndex: number,
  ): AsyncGenerator<WorkflowStreamEvent> {
    const planStep = scheduler.getStep(stepId);
    if (!planStep) {
      scheduler.markFailed(stepId);
      return;
    }

    // Handle condition steps
    if (planStep.stepType === 'condition') {
      yield* this.executeConditionStep(planStep, scheduler, conditionResults, executionIndex);
      return;
    }

    // Handle loop steps
    if (planStep.stepType === 'loop') {
      yield* this.executeLoopStep(planStep, allPlanSteps, scheduler, conditionResults, executionIndex);
      return;
    }

    // Regular step execution
    const step = this.createWorkflowStep(planStep, executionIndex);
    this.state.steps.push(step);
    this.state.currentStepIndex = executionIndex;

    yield this.emit({
      type: 'step_start',
      stepId: planStep.id,
      stepIndex: executionIndex,
      totalSteps: allPlanSteps.length,
      description: planStep.description,
      expectedTools: planStep.expectedTools,
    });

    yield* this.executeStep(step, planStep);

    if (this.isAborted()) {
      scheduler.markFailed(stepId);
      return;
    }

    step.status = step.toolResults.some((r) => !r.success) ? 'failed' : 'success';
    step.completedAt = nowIso();
    step.durationMs = Date.now() - new Date(step.startedAt).getTime();

    yield this.emit({
      type: 'step_end',
      stepId: planStep.id,
      stepIndex: executionIndex,
      status: step.status,
      durationMs: step.durationMs,
    });

    yield this.emit({
      type: 'state_snapshot',
      state: this.getState(),
    });

    if (step.status === 'failed') {
      scheduler.markFailed(stepId);
    } else {
      scheduler.markCompleted(stepId);
    }

    // Reflection for regular steps
    if (this.config.enableReflection && step.status === 'success') {
      this.transition('reflecting');
      const remainingSteps = allPlanSteps.filter(
        (s) => !scheduler.isSkipped(s.id) && s.id !== stepId,
      );
      const reflection = await this.runReflectionPhase(step, remainingSteps);
      yield* this.drainLogBuffer();

      if (reflection) {
        step.reflection = reflection;
        yield this.emit({
          type: 'reflection',
          stepId: planStep.id,
          assessment: reflection.assessment,
          nextAction: reflection.nextAction,
          comment: reflection.comment,
        });

        if (reflection.nextAction === 'complete' && reflection.finalAnswer) {
          this.state.finalAnswer = reflection.finalAnswer;
          yield this.emit({ type: 'message', content: reflection.finalAnswer, done: true });
          this.transition('done');
          return;
        }

        if (reflection.nextAction === 'abort') {
          this.state.errorMessage = reflection.abortReason ?? 'Agent hat Workflow abgebrochen';
          this.transition('error');
          yield this.emit({
            type: 'error',
            message: this.state.errorMessage,
            recoverable: false,
            stepId: planStep.id,
          });
          return;
        }
      }
      this.transition('executing');
    }
  }

  private async executeParallelDagStep(
    stepId: string,
    allPlanSteps: WorkflowPlanStep[],
    scheduler: DagScheduler,
    conditionResults: Map<string, boolean>,
    executionIndex: number,
    channel: AsyncEventChannel<WorkflowStreamEvent>,
  ): Promise<void> {
    const planStep = scheduler.getStep(stepId);
    if (!planStep) {
      scheduler.markFailed(stepId);
      return;
    }

    // For parallel execution, we don't support condition/loop steps
    // (they need sequential control flow)
    const step = this.createWorkflowStep(planStep, executionIndex);
    this.state.steps.push(step);

    channel.push(this.emit({
      type: 'step_start',
      stepId: planStep.id,
      stepIndex: executionIndex,
      totalSteps: allPlanSteps.length,
      description: planStep.description,
      expectedTools: planStep.expectedTools,
    }));

    try {
      for await (const event of this.executeStep(step, planStep)) {
        channel.push(event);
        if (this.isAborted()) break;
      }

      step.status = step.toolResults.some((r) => !r.success) ? 'failed' : 'success';
      step.completedAt = nowIso();
      step.durationMs = Date.now() - new Date(step.startedAt).getTime();

      channel.push(this.emit({
        type: 'step_end',
        stepId: planStep.id,
        stepIndex: executionIndex,
        status: step.status,
        durationMs: step.durationMs,
      }));

      if (step.status === 'failed') {
        scheduler.markFailed(stepId);
      } else {
        scheduler.markCompleted(stepId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Paralleler Step-Fehler';
      step.error = msg;
      step.status = 'failed';
      scheduler.markFailed(stepId);
      channel.push(this.emit({
        type: 'error',
        message: msg,
        recoverable: true,
        stepId: planStep.id,
      }));
    }
  }

  // -------------------------------------------------------------------------
  // Private: Condition Evaluation
  // -------------------------------------------------------------------------

  private async *executeConditionStep(
    planStep: WorkflowPlanStep,
    scheduler: DagScheduler,
    conditionResults: Map<string, boolean>,
    executionIndex: number,
  ): AsyncGenerator<WorkflowStreamEvent> {
    const step = this.createWorkflowStep(planStep, executionIndex);
    this.state.steps.push(step);

    yield this.emit({
      type: 'step_start',
      stepId: planStep.id,
      stepIndex: executionIndex,
      totalSteps: 0,
      description: planStep.description,
      expectedTools: [],
    });

    step.status = 'running';

    try {
      const result = await this.evaluateCondition(planStep);
      conditionResults.set(planStep.id, result);

      yield this.emit({
        type: 'condition_eval',
        stepId: planStep.id,
        result,
        mode: planStep.conditionConfig?.mode ?? 'expression',
      });

      step.status = 'success';
      step.completedAt = nowIso();
      step.durationMs = Date.now() - new Date(step.startedAt).getTime();
      scheduler.markCompleted(planStep.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Condition-Fehler';
      step.error = msg;
      step.status = 'failed';
      step.completedAt = nowIso();
      step.durationMs = Date.now() - new Date(step.startedAt).getTime();
      scheduler.markFailed(planStep.id);

      yield this.emit({
        type: 'error',
        message: msg,
        recoverable: true,
        stepId: planStep.id,
      });
    }

    yield this.emit({
      type: 'step_end',
      stepId: planStep.id,
      stepIndex: executionIndex,
      status: step.status,
      durationMs: step.durationMs ?? 0,
    });
  }

  private async evaluateCondition(planStep: WorkflowPlanStep): Promise<boolean> {
    const config = planStep.conditionConfig;
    if (!config) return true;

    if (config.mode === 'expression') {
      return this.evaluateExpression(config.expression ?? 'true');
    }

    // LLM mode
    return this.evaluateLlmCondition(config.prompt ?? '');
  }

  private evaluateExpression(expression: string): boolean {
    try {
      // Build context from completed steps
      const lastStep = this.state.steps.filter((s) => s.status === 'success').pop();
      const lastResult = lastStep?.toolResults.filter((r) => r.success).pop()?.content ?? '';

      // Safe evaluation with limited scope
      const fn = new Function('result', 'steps', `"use strict"; return Boolean(${expression})`);
      return fn(lastResult, this.state.steps) as boolean;
    } catch {
      return false;
    }
  }

  private async evaluateLlmCondition(prompt: string): Promise<boolean> {
    try {
      const lastStep = this.state.steps.filter((s) => s.status === 'success').pop();
      const lastResult = lastStep?.toolResults.filter((r) => r.success).pop()?.content ?? '';

      const fullPrompt =
        `Kontext (letztes Ergebnis):\n${lastResult.slice(0, 1000)}\n\n` +
        `Frage: ${prompt}\n\n` +
        `Antworte NUR mit "true" oder "false". Keine weitere Erklärung.`;

      const response = await this.provider.chat(
        [...this.messages, { role: 'user', content: fullPrompt }],
        {
          model: this.config.model,
          signal: this.abortController.signal,
          temperature: 0.0,
        },
      );

      const answer = (response.content ?? '').trim().toLowerCase();
      return answer.includes('true');
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Private: Loop Execution
  // -------------------------------------------------------------------------

  private async *executeLoopStep(
    planStep: WorkflowPlanStep,
    allPlanSteps: WorkflowPlanStep[],
    scheduler: DagScheduler,
    conditionResults: Map<string, boolean>,
    executionIndex: number,
  ): AsyncGenerator<WorkflowStreamEvent> {
    const loopConfig = planStep.loopConfig;
    if (!loopConfig) {
      scheduler.markCompleted(planStep.id);
      return;
    }

    const step = this.createWorkflowStep(planStep, executionIndex);
    this.state.steps.push(step);
    step.status = 'running';

    yield this.emit({
      type: 'step_start',
      stepId: planStep.id,
      stepIndex: executionIndex,
      totalSteps: 0,
      description: planStep.description,
      expectedTools: [],
    });

    const maxIter = loopConfig.maxIterations;
    const targetCount = loopConfig.mode === 'count' ? (loopConfig.count ?? maxIter) : maxIter;
    const bodySteps = loopConfig.bodyStepIds
      .map((id) => allPlanSteps.find((s) => s.id === id))
      .filter((s): s is WorkflowPlanStep => s !== undefined);

    try {
      for (let i = 0; i < targetCount && !this.isAborted(); i++) {
        const continuing = i < targetCount - 1;

        yield this.emit({
          type: 'loop_iteration',
          loopStepId: planStep.id,
          iteration: i,
          maxIterations: targetCount,
          continuing,
        });

        // Execute body steps sequentially
        for (const bodyStep of bodySteps) {
          if (this.isAborted()) break;
          const bodyWfStep = this.createWorkflowStep(bodyStep, this.state.steps.length);
          this.state.steps.push(bodyWfStep);

          yield this.emit({
            type: 'step_start',
            stepId: bodyStep.id,
            stepIndex: bodyWfStep.executionIndex,
            totalSteps: bodySteps.length,
            description: bodyStep.description,
            expectedTools: bodyStep.expectedTools,
          });

          yield* this.executeStep(bodyWfStep, bodyStep);

          bodyWfStep.status = bodyWfStep.toolResults.some((r) => !r.success) ? 'failed' : 'success';
          bodyWfStep.completedAt = nowIso();
          bodyWfStep.durationMs = Date.now() - new Date(bodyWfStep.startedAt).getTime();

          yield this.emit({
            type: 'step_end',
            stepId: bodyStep.id,
            stepIndex: bodyWfStep.executionIndex,
            status: bodyWfStep.status,
            durationMs: bodyWfStep.durationMs,
          });
        }

        // Check exit condition for non-count modes
        if (loopConfig.mode === 'condition') {
          const shouldContinue = this.evaluateExpression(loopConfig.expression ?? 'false');
          if (!shouldContinue) break;
        } else if (loopConfig.mode === 'llm') {
          const shouldContinue = await this.evaluateLlmCondition(loopConfig.prompt ?? '');
          if (!shouldContinue) break;
        }
      }

      step.status = 'success';
      step.completedAt = nowIso();
      step.durationMs = Date.now() - new Date(step.startedAt).getTime();
      scheduler.markCompleted(planStep.id);

      // Mark body steps as completed in scheduler so downstream steps unblock
      for (const bodyStep of bodySteps) {
        scheduler.markCompleted(bodyStep.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Loop-Fehler';
      step.error = msg;
      step.status = 'failed';
      step.completedAt = nowIso();
      step.durationMs = Date.now() - new Date(step.startedAt).getTime();
      scheduler.markFailed(planStep.id);

      yield this.emit({
        type: 'error',
        message: msg,
        recoverable: true,
        stepId: planStep.id,
      });
    }

    yield this.emit({
      type: 'step_end',
      stepId: planStep.id,
      stepIndex: executionIndex,
      status: step.status,
      durationMs: step.durationMs ?? 0,
    });
  }

  // -------------------------------------------------------------------------
  // Private: Linear Execution (backward compat)
  // -------------------------------------------------------------------------

  private async *executeLinear(allPlanSteps: WorkflowPlanStep[]): AsyncGenerator<WorkflowStreamEvent> {
    let stepIndex = 0;

    while (stepIndex < allPlanSteps.length && stepIndex < this.config.maxSteps) {
      if (this.isAborted()) break;

      const planStep = allPlanSteps[stepIndex];
      const step = this.createWorkflowStep(planStep, stepIndex);

      this.state.steps.push(step);
      this.state.currentStepIndex = stepIndex;

      yield this.emit({
        type: 'step_start',
        stepId: planStep.id,
        stepIndex,
        totalSteps: allPlanSteps.length,
        description: planStep.description,
        expectedTools: planStep.expectedTools,
      });

      yield* this.executeStep(step, planStep);

      if (this.isAborted()) break;

      step.status = step.toolResults.some((r) => !r.success) ? 'failed' : 'success';
      step.completedAt = nowIso();
      step.durationMs = Date.now() - new Date(step.startedAt).getTime();

      yield this.emit({
        type: 'step_end',
        stepId: planStep.id,
        stepIndex,
        status: step.status,
        durationMs: step.durationMs,
      });

      yield this.emit({
        type: 'state_snapshot',
        state: this.getState(),
      });

      if (this.config.enableReflection) {
        this.transition('reflecting');
        const remainingSteps = allPlanSteps.slice(stepIndex + 1);
        const reflection = await this.runReflectionPhase(step, remainingSteps);
        yield* this.drainLogBuffer();

        if (reflection) {
          step.reflection = reflection;
          yield this.emit({
            type: 'reflection',
            stepId: planStep.id,
            assessment: reflection.assessment,
            nextAction: reflection.nextAction,
            comment: reflection.comment,
          });

          if (reflection.nextAction === 'complete' && reflection.finalAnswer) {
            this.state.finalAnswer = reflection.finalAnswer;
            yield this.emit({ type: 'message', content: reflection.finalAnswer, done: true });
            this.transition('done');
            break;
          }

          if (reflection.nextAction === 'abort') {
            this.state.errorMessage = reflection.abortReason ?? 'Agent hat Workflow abgebrochen';
            this.transition('error');
            yield this.emit({
              type: 'error',
              message: this.state.errorMessage,
              recoverable: false,
              stepId: planStep.id,
            });
            break;
          }

          if (
            reflection.nextAction === 'adjust_plan' &&
            reflection.planAdjustment?.newSteps &&
            this.state.replanCount < this.config.maxRePlans
          ) {
            this.state.replanCount += 1;
            this.transition('planning');
            const newPlan = await this.runAdjustmentPlanningPhase(
              reflection.planAdjustment.reason,
              reflection.planAdjustment.newSteps,
            );

            if (newPlan) {
              this.state.plan = newPlan;
              allPlanSteps.splice(stepIndex + 1, allPlanSteps.length - stepIndex - 1, ...newPlan.steps);
              yield this.emit({
                type: 'plan',
                plan: newPlan,
                isAdjustment: true,
                adjustmentReason: reflection.planAdjustment.reason,
              });
            }
            this.transition('executing');
          }
        }
        this.transition('executing');
      }

      stepIndex += 1;
    }
  }

  // -------------------------------------------------------------------------
  // Private: Planning Phase
  // -------------------------------------------------------------------------

  private async *runPlanningPhase(isReplanning: boolean): AsyncGenerator<WorkflowStreamEvent> {
    const availableTools = this.registry.listNames();
    const prompt =
      `${PLANNING_SYSTEM_PROMPT}\n\n` +
      `Verfügbare Tools: ${availableTools.join(', ')}\n\n` +
      `Aufgabe: ${this.state.userMessage}`;

    try {
      const planningMessages: ChatMessage[] = [
        ...this.messages,
        { role: 'user', content: prompt },
      ];

      const response = await this.provider.chat(planningMessages, {
        model: this.config.model,
        signal: this.abortController.signal,
        temperature: 0.1, // Low temp for structured output
      });

      if (response.content) {
        const plan = parsePlan(response.content, availableTools);
        if (plan) {
          if (isReplanning && this.state.plan) {
            plan.version = this.state.plan.version + 1;
          }
          this.state.plan = plan;
        }
      }
    } catch {
      // Planning failure is non-fatal – we'll use a fallback plan
    }
  }

  private async runAdjustmentPlanningPhase(
    reason: string,
    suggestedSteps: WorkflowPlanStep[],
  ): Promise<WorkflowPlan | null> {
    const currentVersion = this.state.plan?.version ?? 1;

    // Use the suggested steps directly if they look valid
    if (suggestedSteps.length > 0) {
      return {
        goal: this.state.plan?.goal ?? this.state.userMessage,
        steps: suggestedSteps,
        maxSteps: suggestedSteps.length,
        createdAt: nowIso(),
        version: currentVersion + 1,
      };
    }

    // Otherwise try a fresh LLM planning call
    const availableTools = this.registry.listNames();
    const prompt =
      `${PLANNING_SYSTEM_PROMPT}\n\n` +
      `Verfügbare Tools: ${availableTools.join(', ')}\n\n` +
      `Ursprüngliche Aufgabe: ${this.state.userMessage}\n\n` +
      `Grund für Plan-Anpassung: ${reason}\n\n` +
      `Erstelle einen überarbeiteten Plan für die verbleibenden Schritte.`;

    try {
      const response = await this.provider.chat(
        [...this.messages, { role: 'user', content: prompt }],
        {
          model: this.config.model,
          signal: this.abortController.signal,
          temperature: 0.1,
        },
      );

      if (response.content) {
        const plan = parsePlan(response.content, availableTools);
        if (plan) {
          plan.version = currentVersion + 1;
          return plan;
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  private createFallbackPlan(): WorkflowPlan {
    return {
      goal: this.state.userMessage,
      steps: [
        {
          id: 'step-1',
          description: 'Aufgabe direkt ausführen',
          expectedTools: this.config.enabledTools.slice(0, 3),
          dependsOn: [],
          successCriteria: 'Aufgabe erfolgreich abgeschlossen',
        },
      ],
      maxSteps: 1,
      createdAt: nowIso(),
      version: 1,
    };
  }

  // -------------------------------------------------------------------------
  // Private: Step Execution
  // -------------------------------------------------------------------------

  private async *executeStep(
    step: WorkflowStep,
    planStep: WorkflowPlanStep,
  ): AsyncGenerator<WorkflowStreamEvent> {
    step.status = 'running';
    const stepStartMs = Date.now();
    const stepTimeoutSec = (this.config.stepTimeoutMs / 1000).toFixed(0);
    console.log(`[Workflow] ▶ Step "${planStep.description.slice(0, 60)}" started (timeout: ${stepTimeoutSec}s, model: ${this.config.model})`);
    yield this.makeLog('info', `Step "${planStep.description.slice(0, 60)}" started (timeout: ${stepTimeoutSec}s)`, planStep.id);

    // Per-step AbortController with timeout, cascading from parent
    const stepAbort = new AbortController();
    const stepTimeout = setTimeout(() => {
      console.error(`[Workflow] ⏰ Step "${planStep.description.slice(0, 60)}" TIMED OUT after ${stepTimeoutSec}s`);
      this.bufferLog('error', `Step "${planStep.description.slice(0, 60)}" TIMED OUT after ${stepTimeoutSec}s`, planStep.id);
      stepAbort.abort();
    }, this.config.stepTimeoutMs);

    // If the parent aborts, also abort the step
    const onParentAbort = () => stepAbort.abort();
    this.abortController.signal.addEventListener('abort', onParentAbort);

    // Build a focused message for this specific step
    const stepContext = this.buildStepContext(planStep);
    const stepMessages: ChatMessage[] = [
      ...this.messages,
      { role: 'user', content: stepContext },
    ];

    // Build AgentLoopParams for ONE iteration pass
    const loopParams: AgentLoopParams = {
      messages: stepMessages,
      model: this.config.model,
      registry: this.registry,
      options: {
        maxIterations: 5, // Allow multiple tool calls + responses per step
        enabledTools: this.config.enabledTools,
        signal: stepAbort.signal,
        chatOptions: { temperature: 0.3 },
        onLog: (message, level) => {
          this.bufferLog(level, message, planStep.id);
        },
      },
      provider: this.provider,
    };

    let callIndex = 0;

    try {
      for await (const turn of executeAgentLoop(loopParams)) {
        if (this.isAborted() || stepAbort.signal.aborted) break;

        // Convert executor ToolCalls → WorkflowToolCalls
        for (const call of turn.toolCalls) {
          const workflowCall: WorkflowToolCall = {
            id: call.id,
            name: call.name,
            arguments: call.arguments,
            stepId: planStep.id,
            callIndex: callIndex++,
            startedAt: turn.startedAt,
          };
          step.toolCalls.push(workflowCall);

          yield this.emit({
            type: 'tool_call',
            stepId: planStep.id,
            turn: turn.index,
            call: workflowCall,
          });
        }

        // Convert executor ToolResults → WorkflowToolResults
        for (const result of turn.toolResults) {
          const workflowResult: WorkflowToolResult = {
            callId: result.callId,
            content: result.content,
            error: result.error,
            success: result.success,
          };
          step.toolResults.push(workflowResult);

          yield this.emit({
            type: 'tool_result',
            stepId: planStep.id,
            turn: turn.index,
            result: workflowResult,
          });
        }

        // Drain any executor logs buffered via onLog callback
        yield* this.drainLogBuffer();

        // If the executor has a final answer, store it for later
        if (turn.assistantMessage) {
          step.description = step.description; // Keep original
          // Store the partial answer context in the step
          // (it will feed into the final answer generation)
        }
      }
    } catch (err) {
      if (!this.isAborted()) {
        const elapsed = ((Date.now() - stepStartMs) / 1000).toFixed(1);
        const msg = err instanceof Error ? err.message : 'Schritt-Fehler';
        console.error(`[Workflow] ❌ Step "${planStep.description.slice(0, 60)}" failed after ${elapsed}s: ${msg}`);
        step.error = msg;
        step.status = 'failed';

        yield this.makeLog('error', `Step "${planStep.description.slice(0, 60)}" failed after ${elapsed}s: ${msg}`, planStep.id, Date.now() - stepStartMs);
        yield this.emit({
          type: 'error',
          message: msg,
          recoverable: true,
          stepId: planStep.id,
        });
      }
    } finally {
      clearTimeout(stepTimeout);
      this.abortController.signal.removeEventListener('abort', onParentAbort);
      const elapsed = ((Date.now() - stepStartMs) / 1000).toFixed(1);
      if (step.status !== 'failed') {
        console.log(`[Workflow] ✅ Step "${planStep.description.slice(0, 60)}" finished (${elapsed}s)`);
        yield this.makeLog('info', `Step "${planStep.description.slice(0, 60)}" finished (${elapsed}s)`, planStep.id, Date.now() - stepStartMs);
      }
    }
  }

  private buildStepContext(planStep: WorkflowPlanStep): string {
    // Pass full content from previous steps so downstream agents have
    // complete context (e.g. full PDF/Excel text, not just 200 chars).
    const MAX_RESULT_CHARS = 30_000;

    const executedSummary = this.state.steps
      .filter((s) => s.status === 'success' || s.status === 'failed')
      .map((s) => {
        const results = s.toolResults.map((r) => {
          if (!r.success) return `  ❌ ${r.error}`;
          const content =
            r.content.length > MAX_RESULT_CHARS
              ? r.content.slice(0, MAX_RESULT_CHARS) + '\n  ... [truncated]'
              : r.content;
          return `  ✅ ${content}`;
        });
        return `Schritt "${s.description}":\n${results.join('\n') || '  (keine Ergebnisse)'}`;
      })
      .join('\n\n');

    const context =
      executedSummary
        ? `Bisher ausgeführt:\n${executedSummary}\n\n`
        : '';

    return (
      `${context}` +
      `Führe jetzt diesen Schritt aus: ${planStep.description}\n` +
      `Ursprüngliche Aufgabe: ${this.state.userMessage}\n` +
      `Erfolgskriterium: ${planStep.successCriteria}\n` +
      `Bevorzugte Tools: ${planStep.expectedTools.join(', ') || 'beliebig'}`
    );
  }

  // -------------------------------------------------------------------------
  // Private: Reflection Phase
  // -------------------------------------------------------------------------

  private async runReflectionPhase(
    step: WorkflowStep,
    remainingSteps: WorkflowPlanStep[],
  ): Promise<WorkflowStepReflection | null> {
    const prompt = buildReflectionPrompt(step, remainingSteps);

    try {
      const reflStart = Date.now();
      console.log(`[Workflow] 🔍 Reflection LLM call started...`);
      this.bufferLog('info', 'Reflection LLM call started...', step.planStepId);
      const response = await this.provider.chat(
        [...this.messages, { role: 'user', content: prompt }],
        {
          model: this.config.model,
          signal: this.abortController.signal,
          temperature: 0.1,
        },
      );
      const reflDuration = Date.now() - reflStart;
      console.log(`[Workflow] 🔍 Reflection LLM call completed (${(reflDuration / 1000).toFixed(1)}s)`);
      this.bufferLog('info', `Reflection LLM call completed (${(reflDuration / 1000).toFixed(1)}s)`, step.planStepId, reflDuration);

      if (response.content) {
        const reflection = parseReflection(response.content);
        if (reflection?.nextAction === 'abort') {
          console.warn('[Workflow] ⚠️ Reflection chose ABORT:', reflection.comment ?? response.content.slice(0, 200));
          this.bufferLog('warn', `Reflection chose ABORT: ${reflection.comment ?? response.content.slice(0, 200)}`, step.planStepId);
        } else if (reflection) {
          console.log(`[Workflow] 🔍 Reflection result: ${reflection.nextAction} — ${reflection.comment?.slice(0, 100) ?? ''}`);
          this.bufferLog('info', `Reflection result: ${reflection.nextAction} — ${reflection.comment?.slice(0, 100) ?? ''}`, step.planStepId);
        }
        return reflection;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Workflow] ❌ Reflection phase error:', errMsg);
      this.bufferLog('error', `Reflection phase error: ${errMsg}`, step.planStepId);
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Private: Final Answer Generation
  // -------------------------------------------------------------------------

  private async generateFinalAnswer(): Promise<string | null> {
    const stepSummary = this.state.steps
      .map((s) => {
        const results = s.toolResults
          .filter((r) => r.success)
          .map((r) => r.content.slice(0, 500))
          .join('\n');
        return `**${s.description}**:\n${results || 'Keine Ergebnisse'}`;
      })
      .join('\n\n');

    const finalPrompt =
      `Die Aufgabe war: ${this.state.userMessage}\n\n` +
      `Folgende Schritte wurden ausgeführt:\n${stepSummary}\n\n` +
      `Erstelle jetzt eine vollständige, hilfreiche Antwort für den Benutzer ` +
      `basierend auf diesen Ergebnissen. Antworte direkt und präzise.`;

    try {
      const finalStart = Date.now();
      console.log(`[Workflow] 📝 Final answer LLM call started...`);
      this.bufferLog('info', 'Final answer LLM call started...');
      const response = await this.provider.chat(
        [...this.messages, { role: 'user', content: finalPrompt }],
        {
          model: this.config.model,
          signal: this.abortController.signal,
          temperature: 0.4,
        },
      );
      const finalDuration = Date.now() - finalStart;
      const contentLength = response.content?.length ?? 0;
      console.log(`[Workflow] 📝 Final answer LLM call completed (${(finalDuration / 1000).toFixed(1)}s, ${contentLength} chars)`);
      this.bufferLog('info', `Final answer LLM call completed (${(finalDuration / 1000).toFixed(1)}s, ${contentLength} chars)`, undefined, finalDuration);

      return response.content ?? null;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Workflow] ❌ Final answer generation failed: ${errMsg}`);
      this.bufferLog('error', `Final answer generation failed: ${errMsg}`);
      return null;
    }
  }

  /**
   * Build a fallback answer from tool results when the LLM final-answer call
   * returns empty content.
   */
  private buildFallbackAnswer(): string | null {
    const parts: string[] = [];
    for (const step of this.state.steps) {
      const successResults = step.toolResults
        .filter((r) => r.success && r.content.trim())
        .map((r) => r.content.slice(0, 1000));
      if (successResults.length > 0) {
        parts.push(`**${step.description}**:\n${successResults.join('\n')}`);
      }
    }
    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  // -------------------------------------------------------------------------
  // Private: State Machine Helpers
  // -------------------------------------------------------------------------

  /**
   * Buffer a log event (for non-generator methods like runReflectionPhase).
   * Buffered logs are drained via `yield* this.drainLogBuffer()`.
   */
  private bufferLog(level: WorkflowLogEvent['level'], message: string, stepId?: string, durationMs?: number): void {
    this.logBuffer.push({
      type: 'log',
      level,
      message,
      timestamp: nowIso(),
      stepId,
      durationMs,
    });
  }

  /**
   * Yield all buffered log events and clear the buffer.
   */
  private *drainLogBuffer(): Generator<WorkflowStreamEvent> {
    while (this.logBuffer.length > 0) {
      yield this.logBuffer.shift()!;
    }
  }

  /**
   * Create a log event that can be directly yielded from an async generator.
   */
  private makeLog(level: WorkflowLogEvent['level'], message: string, stepId?: string, durationMs?: number): WorkflowLogEvent {
    return {
      type: 'log',
      level,
      message,
      timestamp: nowIso(),
      stepId,
      durationMs,
    };
  }

  private transition(newStatus: WorkflowStatus): void {
    this.state.status = newStatus;
  }

  private isAborted(): boolean {
    return this.abortController.signal.aborted;
  }

  private createWorkflowStep(planStep: WorkflowPlanStep, index: number): WorkflowStep {
    return {
      planStepId: planStep.id,
      executionIndex: index,
      description: planStep.description,
      status: 'pending',
      toolCalls: [],
      toolResults: [],
      startedAt: nowIso(),
    };
  }

  private emit(event: WorkflowStreamEvent): WorkflowStreamEvent {
    return event;
  }

  private async *finalize(startedAt: number): AsyncGenerator<WorkflowStreamEvent> {
    // Drain any remaining buffered logs (e.g. from timeout callbacks)
    yield* this.drainLogBuffer();

    const completedAt = Date.now();
    const durationMs = completedAt - startedAt;

    this.state.completedAt = new Date(completedAt).toISOString();
    this.state.durationMs = durationMs;

    if (this.isAborted() && this.state.status !== 'timeout') {
      this.state.status = 'cancelled';
      yield this.emit({
        type: 'cancelled',
        workflowId: this.state.id,
        completedSteps: this.state.steps.filter((s) => s.status === 'success').length,
      });
    }

    // Final state snapshot for persistence before workflow_end
    yield this.emit({
      type: 'state_snapshot',
      state: this.getState(),
    });

    yield this.emit({
      type: 'workflow_end',
      workflowId: this.state.id,
      status: this.state.status,
      totalSteps: this.state.steps.length,
      durationMs,
    });
  }
}
