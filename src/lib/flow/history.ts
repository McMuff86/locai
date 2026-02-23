// ============================================================================
// Flow History – Persistent storage for workflow run history
// ============================================================================
// Stores run results as JSON files under ~/.locai/flow-history/[flowId]/[runId].json
// ============================================================================

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlowHistoryStepEntry {
  stepId: string;
  description: string;
  status: string;
  durationMs?: number;
  toolCalls: number;
  error?: string;
}

export interface FlowHistoryEntry {
  runId: string;
  flowId: string;
  flowName: string;
  startedAt: string;
  completedAt?: string;
  status: string;
  model: string;
  provider?: string;
  steps: FlowHistoryStepEntry[];
  totalDurationMs?: number;
  goal?: string;
  finalAnswer?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHistoryDir(): string {
  return path.join(os.homedir(), '.locai', 'flow-history');
}

function getFlowDir(flowId: string): string {
  return path.join(getHistoryDir(), flowId);
}

function getRunPath(flowId: string, runId: string): string {
  return path.join(getFlowDir(flowId), `${runId}.json`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save a flow history entry.
 */
export async function saveFlowHistoryEntry(entry: FlowHistoryEntry): Promise<void> {
  const dir = getFlowDir(entry.flowId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getRunPath(entry.flowId, entry.runId), JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * Get all runs for a specific flow, sorted by startedAt descending.
 */
export async function getFlowHistory(flowId: string): Promise<FlowHistoryEntry[]> {
  const dir = getFlowDir(flowId);
  try {
    const files = await fs.readdir(dir);
    const entries: FlowHistoryEntry[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        entries.push(JSON.parse(content) as FlowHistoryEntry);
      } catch {
        // skip corrupt files
      }
    }
    return entries.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  } catch {
    return [];
  }
}

/**
 * Get a specific run by runId (searches all flow directories).
 */
export async function getFlowRun(runId: string): Promise<FlowHistoryEntry | null> {
  const baseDir = getHistoryDir();
  try {
    const flowDirs = await fs.readdir(baseDir);
    for (const flowDir of flowDirs) {
      const runPath = path.join(baseDir, flowDir, `${runId}.json`);
      try {
        const content = await fs.readFile(runPath, 'utf-8');
        return JSON.parse(content) as FlowHistoryEntry;
      } catch {
        // not in this dir
      }
    }
  } catch {
    // base dir doesn't exist
  }
  return null;
}

/**
 * Delete a specific run by runId.
 */
export async function deleteFlowRun(runId: string): Promise<boolean> {
  const baseDir = getHistoryDir();
  try {
    const flowDirs = await fs.readdir(baseDir);
    for (const flowDir of flowDirs) {
      const runPath = path.join(baseDir, flowDir, `${runId}.json`);
      try {
        await fs.unlink(runPath);
        return true;
      } catch {
        // not in this dir
      }
    }
  } catch {
    // base dir doesn't exist
  }
  return false;
}
