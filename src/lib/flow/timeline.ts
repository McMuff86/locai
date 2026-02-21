export interface TimelineEntry {
  stepId: string;
  label: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  status: 'running' | 'success' | 'error' | 'skipped';
  lane: number;
}

export interface TimelineData {
  totalDurationMs: number;
  entries: TimelineEntry[];
  maxLane: number;
}

interface RawTimingEvent {
  stepId: string;
  label: string;
  type: 'start' | 'end';
  timestampMs: number;
  status?: string;
}

/**
 * Build timeline data from raw timing events collected during workflow execution.
 * Uses a greedy lane assignment for parallel steps.
 */
export function buildTimelineFromEvents(events: RawTimingEvent[]): TimelineData {
  // Group start/end events by stepId
  const startMap = new Map<string, RawTimingEvent>();
  const endMap = new Map<string, RawTimingEvent>();

  for (const event of events) {
    if (event.type === 'start') {
      startMap.set(event.stepId, event);
    } else {
      endMap.set(event.stepId, event);
    }
  }

  if (startMap.size === 0) {
    return { totalDurationMs: 0, entries: [], maxLane: 0 };
  }

  // Determine global start time
  let globalStart = Infinity;
  let globalEnd = 0;
  for (const ev of startMap.values()) {
    globalStart = Math.min(globalStart, ev.timestampMs);
  }
  for (const ev of endMap.values()) {
    globalEnd = Math.max(globalEnd, ev.timestampMs);
  }

  // Build entries sorted by start time
  const rawEntries: Array<{
    stepId: string;
    label: string;
    startMs: number;
    endMs: number;
    status: TimelineEntry['status'];
  }> = [];

  for (const [stepId, startEv] of startMap) {
    const endEv = endMap.get(stepId);
    const startMs = startEv.timestampMs - globalStart;
    const endMs = endEv ? endEv.timestampMs - globalStart : globalEnd - globalStart;
    const status = endEv?.status ?? 'running';

    rawEntries.push({
      stepId,
      label: startEv.label,
      startMs,
      endMs,
      status: status as TimelineEntry['status'],
    });
  }

  rawEntries.sort((a, b) => a.startMs - b.startMs);

  // Greedy lane assignment
  const laneEndTimes: number[] = [];
  const entries: TimelineEntry[] = rawEntries.map((raw) => {
    let assignedLane = -1;
    for (let i = 0; i < laneEndTimes.length; i++) {
      if (laneEndTimes[i] <= raw.startMs) {
        assignedLane = i;
        break;
      }
    }
    if (assignedLane === -1) {
      assignedLane = laneEndTimes.length;
      laneEndTimes.push(0);
    }
    laneEndTimes[assignedLane] = raw.endMs;

    return {
      stepId: raw.stepId,
      label: raw.label,
      startMs: raw.startMs,
      endMs: raw.endMs,
      durationMs: raw.endMs - raw.startMs,
      status: raw.status,
      lane: assignedLane,
    };
  });

  const totalDurationMs = globalEnd - globalStart;
  const maxLane = entries.length > 0 ? Math.max(...entries.map((e) => e.lane)) : 0;

  return { totalDurationMs, entries, maxLane };
}

/**
 * Build timeline data from stored step timings (in WorkflowRunSummary).
 */
export function buildTimelineFromStepTimings(
  stepTimings: Array<{
    stepId: string;
    label: string;
    startedAt: string;
    completedAt?: string;
    durationMs: number;
    status: string;
    lane: number;
  }>,
): TimelineData {
  if (stepTimings.length === 0) {
    return { totalDurationMs: 0, entries: [], maxLane: 0 };
  }

  const startTimes = stepTimings.map((t) => new Date(t.startedAt).getTime());
  const globalStart = Math.min(...startTimes);
  let totalDurationMs = 0;

  const entries: TimelineEntry[] = stepTimings.map((t) => {
    const startMs = new Date(t.startedAt).getTime() - globalStart;
    const endMs = startMs + t.durationMs;
    totalDurationMs = Math.max(totalDurationMs, endMs);

    return {
      stepId: t.stepId,
      label: t.label,
      startMs,
      endMs,
      durationMs: t.durationMs,
      status: t.status as TimelineEntry['status'],
      lane: t.lane,
    };
  });

  const maxLane = entries.length > 0 ? Math.max(...entries.map((e) => e.lane)) : 0;

  return { totalDurationMs, entries, maxLane };
}
