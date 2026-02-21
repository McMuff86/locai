import { describe, expect, it } from 'vitest';
import { buildTimelineFromEvents, buildTimelineFromStepTimings } from '@/lib/flow/timeline';

describe('buildTimelineFromEvents', () => {
  it('returns empty timeline for no events', () => {
    const result = buildTimelineFromEvents([]);
    expect(result.entries).toEqual([]);
    expect(result.totalDurationMs).toBe(0);
    expect(result.maxLane).toBe(0);
  });

  it('builds a single-entry timeline', () => {
    const events = [
      { stepId: 'A', label: 'Step A', type: 'start' as const, timestampMs: 1000 },
      { stepId: 'A', label: 'Step A', type: 'end' as const, timestampMs: 2000, status: 'success' },
    ];
    const result = buildTimelineFromEvents(events);

    expect(result.entries.length).toBe(1);
    expect(result.entries[0].stepId).toBe('A');
    expect(result.entries[0].durationMs).toBe(1000);
    expect(result.entries[0].status).toBe('success');
    expect(result.entries[0].lane).toBe(0);
    expect(result.totalDurationMs).toBe(1000);
  });

  it('assigns sequential steps to the same lane', () => {
    const events = [
      { stepId: 'A', label: 'Step A', type: 'start' as const, timestampMs: 1000 },
      { stepId: 'A', label: 'Step A', type: 'end' as const, timestampMs: 2000, status: 'success' },
      { stepId: 'B', label: 'Step B', type: 'start' as const, timestampMs: 2000 },
      { stepId: 'B', label: 'Step B', type: 'end' as const, timestampMs: 3000, status: 'success' },
    ];
    const result = buildTimelineFromEvents(events);

    expect(result.entries.length).toBe(2);
    // Sequential — should reuse lane 0
    expect(result.entries[0].lane).toBe(0);
    expect(result.entries[1].lane).toBe(0);
    expect(result.maxLane).toBe(0);
  });

  it('assigns parallel steps to different lanes', () => {
    const events = [
      { stepId: 'A', label: 'Step A', type: 'start' as const, timestampMs: 1000 },
      { stepId: 'B', label: 'Step B', type: 'start' as const, timestampMs: 1000 },
      { stepId: 'A', label: 'Step A', type: 'end' as const, timestampMs: 2000, status: 'success' },
      { stepId: 'B', label: 'Step B', type: 'end' as const, timestampMs: 2500, status: 'success' },
    ];
    const result = buildTimelineFromEvents(events);

    expect(result.entries.length).toBe(2);
    const lanes = result.entries.map((e) => e.lane).sort();
    expect(lanes).toEqual([0, 1]);
    expect(result.maxLane).toBe(1);
  });

  it('handles running steps without end event', () => {
    const events = [
      { stepId: 'A', label: 'Step A', type: 'start' as const, timestampMs: 1000 },
    ];
    const result = buildTimelineFromEvents(events);

    expect(result.entries.length).toBe(1);
    expect(result.entries[0].status).toBe('running');
  });
});

describe('buildTimelineFromStepTimings', () => {
  it('returns empty timeline for empty array', () => {
    const result = buildTimelineFromStepTimings([]);
    expect(result.entries).toEqual([]);
    expect(result.totalDurationMs).toBe(0);
  });

  it('builds timeline from step timings', () => {
    const timings = [
      {
        stepId: 'A',
        label: 'Step A',
        startedAt: '2025-01-01T00:00:00.000Z',
        completedAt: '2025-01-01T00:00:01.000Z',
        durationMs: 1000,
        status: 'success',
        lane: 0,
      },
      {
        stepId: 'B',
        label: 'Step B',
        startedAt: '2025-01-01T00:00:01.000Z',
        completedAt: '2025-01-01T00:00:02.000Z',
        durationMs: 1000,
        status: 'success',
        lane: 0,
      },
    ];
    const result = buildTimelineFromStepTimings(timings);

    expect(result.entries.length).toBe(2);
    expect(result.totalDurationMs).toBe(2000);
    expect(result.entries[0].startMs).toBe(0);
    expect(result.entries[1].startMs).toBe(1000);
  });
});
