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
import { OllamaProvider } from '../providers/ollama-provider';
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
  WORKFLOW_DEFAULTS,
} from './workflowTypes';

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
  /** Workflow configuration (merged with WORKFLOW_DEFAULTS) */
  config?: Partial<WorkflowConfig>;
  /** Conversation ID for state tracking */
  conversationId?: string;
  /** Optional externally compiled plan (e.g. visual flow) */
  initialPlan?: WorkflowPlan;
  /** Ollama host override (deprecated — use provider) */
  host?: string;
  /** Chat provider to use (default: OllamaProvider) */
  provider?: ChatProvider;
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

  constructor(options: WorkflowEngineOptions) {
    const {
      message,
      messages,
      model,
      registry,
      config: configOverrides = {},
      conversationId,
    } = options;

    this.registry = registry;
    this.messages = messages;
    this.provider = options.provider ?? new OllamaProvider(options.host);
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
    const timeoutId = setTimeout(() => {
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
      // Phase 2: Execute Steps
      // -----------------------------------------------------------------------
      let stepIndex = 0;
      const allPlanSteps = [...this.state.plan.steps];

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

        // Execute this step via the existing agent loop (one iteration)
        yield* this.executeStep(step, planStep);

        if (this.isAborted()) break;

        // Mark step complete
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

        // -----------------------------------------------------------------------
        // Phase 3: Reflection
        // -----------------------------------------------------------------------
        if (this.config.enableReflection) {
          this.transition('reflecting');
          const remainingSteps = allPlanSteps.slice(stepIndex + 1);
          const reflection = await this.runReflectionPhase(step, remainingSteps);

          if (reflection) {
            step.reflection = reflection;

            yield this.emit({
              type: 'reflection',
              stepId: planStep.id,
              assessment: reflection.assessment,
              nextAction: reflection.nextAction,
              comment: reflection.comment,
            });

            // Handle reflection outcome
            if (reflection.nextAction === 'complete' && reflection.finalAnswer) {
              // Early exit: agent has the answer
              this.state.finalAnswer = reflection.finalAnswer;
              yield this.emit({
                type: 'message',
                content: reflection.finalAnswer,
                done: true,
              });
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

              // Re-planning phase
              this.transition('planning');
              const newPlan = await this.runAdjustmentPlanningPhase(
                reflection.planAdjustment.reason,
                reflection.planAdjustment.newSteps,
              );

              if (newPlan) {
                this.state.plan = newPlan;
                // Replace remaining steps with new plan steps
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

      // -----------------------------------------------------------------------
      // Phase 4: Final Answer (if not done via early exit)
      // -----------------------------------------------------------------------
      if (this.state.status !== 'done' && this.state.status !== 'error' && !this.isAborted()) {
        this.transition('done');

        const finalAnswer = await this.generateFinalAnswer();
        if (finalAnswer) {
          this.state.finalAnswer = finalAnswer;
          yield this.emit({
            type: 'message',
            content: finalAnswer,
            done: true,
          });
        }
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
        maxIterations: 1, // One step at a time
        enabledTools: this.config.enabledTools,
        signal: this.abortController.signal,
        chatOptions: { temperature: 0.3 },
      },
      provider: this.provider,
    };

    let callIndex = 0;

    try {
      for await (const turn of executeAgentLoop(loopParams)) {
        if (this.isAborted()) break;

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

        // If the executor has a final answer, store it for later
        if (turn.assistantMessage) {
          step.description = step.description; // Keep original
          // Store the partial answer context in the step
          // (it will feed into the final answer generation)
        }
      }
    } catch (err) {
      if (!this.isAborted()) {
        const msg = err instanceof Error ? err.message : 'Schritt-Fehler';
        step.error = msg;
        step.status = 'failed';

        yield this.emit({
          type: 'error',
          message: msg,
          recoverable: true,
          stepId: planStep.id,
        });
      }
    }
  }

  private buildStepContext(planStep: WorkflowPlanStep): string {
    const executedSummary = this.state.steps
      .filter((s) => s.status === 'success' || s.status === 'failed')
      .map((s) => {
        const results = s.toolResults.map((r) =>
          r.success ? `  ✅ ${r.content.slice(0, 200)}` : `  ❌ ${r.error}`,
        );
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
      const response = await this.provider.chat(
        [...this.messages, { role: 'user', content: prompt }],
        {
          model: this.config.model,
          signal: this.abortController.signal,
          temperature: 0.1,
        },
      );

      if (response.content) {
        return parseReflection(response.content);
      }
    } catch {
      // Reflection failure is non-fatal
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
      const response = await this.provider.chat(
        [...this.messages, { role: 'user', content: finalPrompt }],
        {
          model: this.config.model,
          signal: this.abortController.signal,
          temperature: 0.4,
        },
      );

      return response.content || null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Private: State Machine Helpers
  // -------------------------------------------------------------------------

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

    yield this.emit({
      type: 'workflow_end',
      workflowId: this.state.id,
      status: this.state.status,
      totalSteps: this.state.steps.length,
      durationMs,
    });
  }
}
