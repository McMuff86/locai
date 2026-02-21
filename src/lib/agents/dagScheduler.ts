import type { WorkflowPlanStep } from './workflowTypes';

/**
 * DAG-based scheduler for parallel workflow step execution.
 * Tracks step dependencies and determines which steps are ready to run.
 */
export class DagScheduler {
  private steps: Map<string, WorkflowPlanStep>;
  private completed = new Set<string>();
  private running = new Set<string>();
  private skipped = new Set<string>();
  private failed = new Set<string>();

  constructor(planSteps: WorkflowPlanStep[]) {
    this.steps = new Map(planSteps.map((s) => [s.id, s]));
  }

  /** Returns step IDs whose ALL dependsOn are completed/skipped and that aren't already running/completed/skipped/failed */
  getReadySteps(): string[] {
    const ready: string[] = [];
    for (const [id, step] of this.steps) {
      if (this.completed.has(id) || this.running.has(id) || this.skipped.has(id) || this.failed.has(id)) {
        continue;
      }
      const allDepsResolved = step.dependsOn.every(
        (depId) => this.completed.has(depId) || this.skipped.has(depId),
      );
      if (allDepsResolved) {
        ready.push(id);
      }
    }
    return ready;
  }

  markRunning(stepId: string): void {
    this.running.add(stepId);
  }

  markCompleted(stepId: string): void {
    this.running.delete(stepId);
    this.completed.add(stepId);
  }

  markSkipped(stepId: string): void {
    this.running.delete(stepId);
    this.skipped.add(stepId);
  }

  markFailed(stepId: string): void {
    this.running.delete(stepId);
    this.failed.add(stepId);
  }

  isSkipped(stepId: string): boolean {
    return this.skipped.has(stepId);
  }

  isFinished(): boolean {
    for (const id of this.steps.keys()) {
      if (!this.completed.has(id) && !this.skipped.has(id) && !this.failed.has(id)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Determines if a step should be skipped based on condition results.
   * A step is skipped if it has a branchCondition and the condition result
   * doesn't match the required branch.
   */
  shouldSkip(stepId: string, conditionResults: Map<string, boolean>): boolean {
    const step = this.steps.get(stepId);
    if (!step?.branchCondition) {
      return false;
    }

    const { conditionStepId, branch } = step.branchCondition;
    const condResult = conditionResults.get(conditionStepId);

    // If the condition hasn't been evaluated yet, don't skip
    if (condResult === undefined) {
      return false;
    }

    // Skip if the condition result doesn't match the required branch
    if (branch === 'true' && !condResult) return true;
    if (branch === 'false' && condResult) return true;

    return false;
  }

  getStep(stepId: string): WorkflowPlanStep | undefined {
    return this.steps.get(stepId);
  }

  getRunningCount(): number {
    return this.running.size;
  }
}
