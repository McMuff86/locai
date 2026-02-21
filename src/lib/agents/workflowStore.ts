// ============================================================================
// Workflow Store — Filesystem Persistence
// ============================================================================
// Server-side CRUD for completed workflows.
// Pattern: src/lib/conversations/store.ts (index.json + {id}.json)
//
// Path: ~/.locai/workflows/
// ============================================================================

import path from 'path';
import { promises as fs } from 'fs';
import type { WorkflowState, WorkflowSummary } from './workflowTypes';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function defaultBasePath(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '/tmp';
  return path.join(home, '.locai', 'workflows');
}

function indexFilePath(basePath: string): string {
  return path.join(basePath, 'workflows-index.json');
}

function workflowFilePath(basePath: string, id: string): string {
  return path.join(basePath, `${id}.json`);
}

async function ensureDir(basePath: string): Promise<void> {
  await fs.mkdir(basePath, { recursive: true });
}

// ---------------------------------------------------------------------------
// Build summary from full WorkflowState
// ---------------------------------------------------------------------------

function buildSummary(state: WorkflowState): WorkflowSummary {
  return {
    id: state.id,
    goal: state.plan?.goal ?? state.userMessage,
    conversationId: state.conversationId,
    status: state.status,
    stepCount: state.steps.length,
    createdAt: state.startedAt,
    completedAt: state.completedAt,
    durationMs: state.durationMs,
  };
}

// ---------------------------------------------------------------------------
// Index operations
// ---------------------------------------------------------------------------

export async function loadIndex(basePath?: string): Promise<WorkflowSummary[]> {
  const dir = basePath || defaultBasePath();
  const filePath = indexFilePath(dir);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WorkflowSummary[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('[WorkflowStore] Failed to load index:', err);
    return [];
  }
}

async function saveIndex(basePath: string, index: WorkflowSummary[]): Promise<void> {
  await ensureDir(basePath);
  const filePath = indexFilePath(basePath);
  await fs.writeFile(filePath, JSON.stringify(index, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/** Load a single full workflow by ID */
export async function loadWorkflow(id: string, basePath?: string): Promise<WorkflowState | null> {
  if (!id || /[/\\]/.test(id)) return null;
  const dir = basePath || defaultBasePath();
  const filePath = workflowFilePath(dir, id);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as WorkflowState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    console.error(`[WorkflowStore] Failed to load workflow ${id}:`, err);
    return null;
  }
}

/** Save a completed workflow (creates or updates) */
export async function saveWorkflow(state: WorkflowState, basePath?: string): Promise<void> {
  if (!state.id || /[/\\]/.test(state.id)) {
    throw new Error('Invalid workflow ID');
  }
  const dir = basePath || defaultBasePath();
  await ensureDir(dir);

  // Write the full workflow file
  const filePath = workflowFilePath(dir, state.id);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');

  // Update the index
  const index = await loadIndex(dir);
  const summary = buildSummary(state);
  const idx = index.findIndex((s) => s.id === state.id);
  if (idx >= 0) {
    index[idx] = summary;
  } else {
    index.push(summary);
  }

  // Sort by most recently created
  index.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  await saveIndex(dir, index);
}

/** Delete a single workflow */
export async function deleteWorkflow(id: string, basePath?: string): Promise<boolean> {
  if (!id || /[/\\]/.test(id)) return false;
  const dir = basePath || defaultBasePath();

  // Remove from index
  const index = await loadIndex(dir);
  const filtered = index.filter((s) => s.id !== id);
  if (filtered.length === index.length) return false; // Not found

  await saveIndex(dir, filtered);

  // Remove workflow file (best effort)
  try {
    await fs.unlink(workflowFilePath(dir, id));
  } catch {
    // File may not exist
  }

  return true;
}
