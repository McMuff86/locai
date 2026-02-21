import { describe, expect, it } from 'vitest';
import { DagScheduler } from '@/lib/agents/dagScheduler';
import type { WorkflowPlanStep } from '@/lib/agents/workflowTypes';

function makeStep(id: string, dependsOn: string[] = [], extra: Partial<WorkflowPlanStep> = {}): WorkflowPlanStep {
  return {
    id,
    description: `Step ${id}`,
    expectedTools: [],
    dependsOn,
    successCriteria: 'done',
    ...extra,
  };
}

describe('DagScheduler', () => {
  it('handles a linear chain: A -> B -> C sequentially', () => {
    const steps = [
      makeStep('A'),
      makeStep('B', ['A']),
      makeStep('C', ['B']),
    ];
    const scheduler = new DagScheduler(steps);

    // Only A is ready initially
    expect(scheduler.getReadySteps()).toEqual(['A']);

    scheduler.markRunning('A');
    expect(scheduler.getReadySteps()).toEqual([]);

    scheduler.markCompleted('A');
    expect(scheduler.getReadySteps()).toEqual(['B']);

    scheduler.markRunning('B');
    scheduler.markCompleted('B');
    expect(scheduler.getReadySteps()).toEqual(['C']);

    scheduler.markRunning('C');
    scheduler.markCompleted('C');
    expect(scheduler.isFinished()).toBe(true);
  });

  it('handles diamond: A -> [B, C] -> D with B and C parallel', () => {
    const steps = [
      makeStep('A'),
      makeStep('B', ['A']),
      makeStep('C', ['A']),
      makeStep('D', ['B', 'C']),
    ];
    const scheduler = new DagScheduler(steps);

    expect(scheduler.getReadySteps()).toEqual(['A']);
    scheduler.markRunning('A');
    scheduler.markCompleted('A');

    // B and C should both be ready
    const ready = scheduler.getReadySteps();
    expect(ready.sort()).toEqual(['B', 'C']);

    scheduler.markRunning('B');
    scheduler.markRunning('C');
    expect(scheduler.getReadySteps()).toEqual([]);

    scheduler.markCompleted('B');
    // D still not ready (C still running)
    expect(scheduler.getReadySteps()).toEqual([]);

    scheduler.markCompleted('C');
    expect(scheduler.getReadySteps()).toEqual(['D']);

    scheduler.markRunning('D');
    scheduler.markCompleted('D');
    expect(scheduler.isFinished()).toBe(true);
  });

  it('skips steps in non-taken condition branches', () => {
    const steps = [
      makeStep('cond', [], { stepType: 'condition' }),
      makeStep('true-branch', ['cond'], {
        branchCondition: { conditionStepId: 'cond', branch: 'true' },
      }),
      makeStep('false-branch', ['cond'], {
        branchCondition: { conditionStepId: 'cond', branch: 'false' },
      }),
    ];
    const scheduler = new DagScheduler(steps);
    const conditionResults = new Map<string, boolean>();

    scheduler.markRunning('cond');
    scheduler.markCompleted('cond');
    conditionResults.set('cond', true);

    const ready = scheduler.getReadySteps();
    expect(ready.sort()).toEqual(['false-branch', 'true-branch']);

    // true-branch should not be skipped
    expect(scheduler.shouldSkip('true-branch', conditionResults)).toBe(false);
    // false-branch should be skipped
    expect(scheduler.shouldSkip('false-branch', conditionResults)).toBe(true);
  });

  it('isFinished is correct when all steps are completed', () => {
    const steps = [makeStep('A'), makeStep('B')];
    const scheduler = new DagScheduler(steps);

    expect(scheduler.isFinished()).toBe(false);

    scheduler.markRunning('A');
    scheduler.markCompleted('A');
    expect(scheduler.isFinished()).toBe(false);

    scheduler.markRunning('B');
    scheduler.markCompleted('B');
    expect(scheduler.isFinished()).toBe(true);
  });

  it('isFinished is true when all steps are skipped', () => {
    const steps = [makeStep('A'), makeStep('B')];
    const scheduler = new DagScheduler(steps);

    scheduler.markSkipped('A');
    scheduler.markSkipped('B');
    expect(scheduler.isFinished()).toBe(true);
  });

  it('handles failed steps correctly', () => {
    const steps = [
      makeStep('A'),
      makeStep('B', ['A']),
    ];
    const scheduler = new DagScheduler(steps);

    scheduler.markRunning('A');
    scheduler.markFailed('A');

    // B depends on A which failed — A is not completed, so B should not be ready
    expect(scheduler.getReadySteps()).toEqual([]);
    // But the scheduler should not be finished (B is still pending)
    expect(scheduler.isFinished()).toBe(false);
  });

  it('getRunningCount returns correct count', () => {
    const steps = [makeStep('A'), makeStep('B'), makeStep('C')];
    const scheduler = new DagScheduler(steps);

    expect(scheduler.getRunningCount()).toBe(0);

    scheduler.markRunning('A');
    scheduler.markRunning('B');
    expect(scheduler.getRunningCount()).toBe(2);

    scheduler.markCompleted('A');
    expect(scheduler.getRunningCount()).toBe(1);
  });
});
