// ============================================================================
// Memory Store
// ============================================================================
// Filesystem CRUD + keyword search + relevance scoring for agent memory.
// ============================================================================

import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { MemoryEntry, MemoryStore, MemoryLogEvent, MemoryCategory, MemoryType } from './types';
import { MAX_MEMORY_ENTRIES, MEMORY_SCHEMA_VERSION, MEMORY_FILE, MEMORY_LOG_FILE } from './constants';
import { getFlowHistory, type FlowHistoryEntry } from '@/lib/flow/history';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function defaultBasePath(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '/tmp';
  return path.join(home, '.locai', 'memory');
}

function memoryFilePath(basePath: string): string {
  return path.join(basePath, MEMORY_FILE);
}

function logFilePath(basePath: string): string {
  return path.join(basePath, MEMORY_LOG_FILE);
}

async function ensureDir(basePath: string): Promise<void> {
  await fs.mkdir(basePath, { recursive: true });
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

export async function loadMemoryStore(basePath?: string): Promise<MemoryStore> {
  const dir = basePath || defaultBasePath();
  const filePath = memoryFilePath(dir);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as MemoryStore;
    return {
      version: parsed.version ?? MEMORY_SCHEMA_VERSION,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: MEMORY_SCHEMA_VERSION, entries: [] };
    }
    console.error('[MemoryStore] Failed to load:', err);
    return { version: MEMORY_SCHEMA_VERSION, entries: [] };
  }
}

async function saveMemoryStore(store: MemoryStore, basePath?: string): Promise<void> {
  const dir = basePath || defaultBasePath();
  await ensureDir(dir);
  const filePath = memoryFilePath(dir);
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

async function appendLog(event: MemoryLogEvent, basePath?: string): Promise<void> {
  const dir = basePath || defaultBasePath();
  await ensureDir(dir);
  const filePath = logFilePath(dir);
  await fs.appendFile(filePath, JSON.stringify(event) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function saveMemory(
  params: {
    key: string;
    value: string;
    category: MemoryCategory;
    tags?: string[];
    source?: string;
  },
  basePath?: string,
): Promise<MemoryEntry> {
  const store = await loadMemoryStore(basePath);
  const now = new Date().toISOString();

  // Check if key already exists → update
  const existingIdx = store.entries.findIndex(e => e.key === params.key);

  let entry: MemoryEntry;

  if (existingIdx >= 0) {
    entry = {
      ...store.entries[existingIdx],
      value: params.value,
      category: params.category,
      tags: params.tags ?? store.entries[existingIdx].tags,
      source: params.source ?? store.entries[existingIdx].source,
      updatedAt: now,
    };
    store.entries[existingIdx] = entry;

    await appendLog({
      timestamp: now,
      action: 'update',
      entryId: entry.id,
      key: entry.key,
      value: entry.value,
      category: entry.category,
    }, basePath);
  } else {
    entry = {
      id: uuidv4(),
      key: params.key,
      value: params.value,
      category: params.category,
      tags: params.tags,
      source: params.source,
      createdAt: now,
      updatedAt: now,
    };

    // Enforce max entries
    if (store.entries.length >= MAX_MEMORY_ENTRIES) {
      // Remove oldest entry
      const oldest = store.entries.reduce((min, e) =>
        new Date(e.updatedAt) < new Date(min.updatedAt) ? e : min
      );
      store.entries = store.entries.filter(e => e.id !== oldest.id);
    }

    store.entries.push(entry);

    await appendLog({
      timestamp: now,
      action: 'create',
      entryId: entry.id,
      key: entry.key,
      value: entry.value,
      category: entry.category,
    }, basePath);
  }

  await saveMemoryStore(store, basePath);
  return entry;
}

export async function updateMemory(
  id: string,
  updates: {
    key?: string;
    value?: string;
    category?: MemoryCategory;
    tags?: string[];
  },
  basePath?: string,
): Promise<MemoryEntry | null> {
  const store = await loadMemoryStore(basePath);
  const idx = store.entries.findIndex(e => e.id === id);
  if (idx < 0) return null;

  const now = new Date().toISOString();
  const entry = store.entries[idx];

  if (updates.key !== undefined) entry.key = updates.key;
  if (updates.value !== undefined) entry.value = updates.value;
  if (updates.category !== undefined) entry.category = updates.category;
  if (updates.tags !== undefined) entry.tags = updates.tags;
  entry.updatedAt = now;

  // Re-generate embedding if key or value changed
  if (updates.key !== undefined || updates.value !== undefined) {
    try {
      entry.embedding = await generateEmbedding(`${entry.key}: ${entry.value}`);
    } catch {
      // best-effort
    }
  }

  store.entries[idx] = entry;
  await saveMemoryStore(store, basePath);

  await appendLog({
    timestamp: now,
    action: 'update',
    entryId: entry.id,
    key: entry.key,
    value: entry.value,
    category: entry.category,
  }, basePath);

  return entry;
}

export async function deleteMemory(id: string, basePath?: string): Promise<boolean> {
  const store = await loadMemoryStore(basePath);
  const entry = store.entries.find(e => e.id === id);
  if (!entry) return false;

  store.entries = store.entries.filter(e => e.id !== id);
  await saveMemoryStore(store, basePath);

  await appendLog({
    timestamp: new Date().toISOString(),
    action: 'delete',
    entryId: id,
    key: entry.key,
  }, basePath);

  return true;
}

export async function listMemories(basePath?: string): Promise<MemoryEntry[]> {
  const store = await loadMemoryStore(basePath);
  return store.entries.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ---------------------------------------------------------------------------
// Keyword search + relevance scoring
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(t => t.length > 1);
}

function computeRelevance(entry: MemoryEntry, queryTokens: string[]): number {
  let score = 0;
  const keyLower = entry.key.toLowerCase();
  const valueLower = entry.value.toLowerCase();
  const tagStr = (entry.tags ?? []).join(' ').toLowerCase();

  for (const token of queryTokens) {
    // Key match (highest weight)
    if (keyLower.includes(token)) score += 5;
    // Value match
    if (valueLower.includes(token)) score += 2;
    // Tag match
    if (tagStr.includes(token)) score += 3;
  }

  // Recency boost: entries updated within last 24h get +1 (only if there's already a keyword match)
  if (score > 0) {
    const hoursAgo = (Date.now() - new Date(entry.updatedAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 24) score += 1;
  }

  return score;
}

export async function searchMemories(
  query: string,
  limit: number = 10,
  basePath?: string,
): Promise<MemoryEntry[]> {
  const store = await loadMemoryStore(basePath);
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) return [];

  const scored = store.entries
    .map(entry => ({ entry, score: computeRelevance(entry, queryTokens) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(s => s.entry);
}

/**
 * Get relevant memories for a user message (for auto-injection).
 * Uses semantic search if embeddings are available, falls back to keyword search.
 * Respects a ~2000 token budget and 0.7 confidence threshold.
 */
export async function getRelevantMemories(
  message: string,
  limit: number = 10,
  basePath?: string,
): Promise<MemoryEntry[]> {
  // Try semantic search first
  try {
    const semanticResults = await semanticSearch(message, limit, 0.7, basePath);
    if (semanticResults.length > 0) {
      return applyTokenBudget(semanticResults, 2000);
    }
  } catch {
    // Fall back to keyword search
  }
  const results = await searchMemories(message, limit, basePath);
  return applyTokenBudget(results, 2000);
}

/**
 * Estimate token count (~4 chars per token).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Trim memories to fit within a token budget.
 */
function applyTokenBudget(memories: MemoryEntry[], maxTokens: number): MemoryEntry[] {
  const result: MemoryEntry[] = [];
  let tokens = 0;
  for (const m of memories) {
    const entryTokens = estimateTokens(`- [${m.category}] ${m.key}: ${m.value}`);
    if (tokens + entryTokens > maxTokens) break;
    tokens += entryTokens;
    result.push(m);
  }
  return result;
}

/**
 * Format memory entries for injection into system message.
 */
export function formatMemories(memories: MemoryEntry[]): string {
  return memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join('\n');
}

// ---------------------------------------------------------------------------
// Embedding helpers (Ollama nomic-embed-text)
// ---------------------------------------------------------------------------

const EMBED_MODEL = 'nomic-embed-text';

async function getOllamaHost(): Promise<string> {
  return process.env.OLLAMA_HOST || 'http://localhost:11434';
}

async function generateEmbedding(text: string): Promise<number[]> {
  const host = await getOllamaHost();
  const resp = await fetch(`${host}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!resp.ok) {
    throw new Error(`Embedding request failed: ${resp.status}`);
  }
  const data = await resp.json();
  if (data.embeddings && Array.isArray(data.embeddings) && data.embeddings.length > 0) {
    return data.embeddings[0];
  }
  if (data.embedding && Array.isArray(data.embedding)) {
    return data.embedding;
  }
  throw new Error('No embedding returned from Ollama');
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Semantic search
// ---------------------------------------------------------------------------

export async function semanticSearch(
  query: string,
  limit: number = 10,
  threshold: number = 0.7,
  basePath?: string,
): Promise<MemoryEntry[]> {
  const queryEmbedding = await generateEmbedding(query);
  const store = await loadMemoryStore(basePath);
  const now = new Date().toISOString();

  const scored = store.entries
    .filter(e => e.embedding && e.embedding.length > 0)
    .map(entry => ({
      entry,
      score: cosineSimilarity(queryEmbedding, entry.embedding!),
    }))
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Update lastAccessedAt for retrieved memories
  if (scored.length > 0) {
    const accessedIds = new Set(scored.map(s => s.entry.id));
    for (const entry of store.entries) {
      if (accessedIds.has(entry.id)) {
        entry.lastAccessedAt = now;
      }
    }
    await saveMemoryStore(store, basePath);
  }

  return scored.map(s => s.entry);
}

// ---------------------------------------------------------------------------
// Enhanced save with embedding
// ---------------------------------------------------------------------------

export async function saveMemoryWithEmbedding(
  params: {
    key: string;
    value: string;
    category: MemoryCategory;
    type?: MemoryType;
    tags?: string[];
    source?: string;
    metadata?: Record<string, unknown>;
  },
  basePath?: string,
): Promise<MemoryEntry> {
  let embedding: number[] | undefined;
  try {
    embedding = await generateEmbedding(`${params.key}: ${params.value}`);
  } catch {
    // Embedding generation is best-effort
  }

  const entry = await saveMemory(params, basePath);

  if (embedding || params.type || params.metadata) {
    const store = await loadMemoryStore(basePath);
    const idx = store.entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      if (embedding) store.entries[idx].embedding = embedding;
      if (params.type) store.entries[idx].type = params.type;
      if (params.metadata) store.entries[idx].metadata = params.metadata as MemoryEntry['metadata'];
      store.entries[idx].lastAccessedAt = new Date().toISOString();
      await saveMemoryStore(store, basePath);
      return store.entries[idx];
    }
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Prune: archive old memories (>30 days without access)
// ---------------------------------------------------------------------------

const PRUNE_DAYS = 30;

export interface PruneResult {
  archived: number;
  remaining: number;
  archivedIds: string[];
}

export async function pruneMemories(basePath?: string): Promise<PruneResult> {
  const dir = basePath || defaultBasePath();
  const store = await loadMemoryStore(dir);
  const now = Date.now();
  const cutoff = now - PRUNE_DAYS * 24 * 60 * 60 * 1000;

  const toArchive: MemoryEntry[] = [];
  const toKeep: MemoryEntry[] = [];

  for (const entry of store.entries) {
    const lastAccess = entry.lastAccessedAt
      ? new Date(entry.lastAccessedAt).getTime()
      : new Date(entry.updatedAt).getTime();

    if (lastAccess < cutoff) {
      toArchive.push(entry);
    } else {
      toKeep.push(entry);
    }
  }

  if (toArchive.length === 0) {
    return { archived: 0, remaining: store.entries.length, archivedIds: [] };
  }

  const archivePath = path.join(dir, 'archive.jsonl');
  await ensureDir(dir);
  const archiveLines = toArchive.map(e => JSON.stringify(e)).join('\n') + '\n';
  await fs.appendFile(archivePath, archiveLines, 'utf-8');

  store.entries = toKeep;
  await saveMemoryStore(store, dir);

  const timestamp = new Date().toISOString();
  for (const entry of toArchive) {
    await appendLog({
      timestamp,
      action: 'prune',
      entryId: entry.id,
      key: entry.key,
    }, dir);
  }

  return {
    archived: toArchive.length,
    remaining: toKeep.length,
    archivedIds: toArchive.map(e => e.id),
  };
}

// ---------------------------------------------------------------------------
// Recall past workflow runs for a flow template
// ---------------------------------------------------------------------------

/**
 * Retrieve past run summaries for a specific flow template.
 * Returns a formatted string (max ~500 tokens) suitable for system prompt injection.
 */
export async function recallWorkflowRuns(
  flowId: string,
  limit: number = 5,
): Promise<string> {
  const history = await getFlowHistory(flowId);
  if (history.length === 0) return '';

  const runs = history.slice(0, limit);

  const lines = runs.map((run: FlowHistoryEntry) => {
    const date = new Date(run.startedAt).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const durationSec = run.totalDurationMs
      ? `${(run.totalDurationMs / 1000).toFixed(1)}s`
      : 'unbekannt';
    const status = run.status === 'done' ? '✅' : run.status === 'error' ? '❌' : '⏳';
    const answer = run.finalAnswer
      ? run.finalAnswer.slice(0, 120).replace(/\n/g, ' ')
      : 'kein Ergebnis';
    return `- ${status} ${date} | Modell: ${run.model} | Dauer: ${durationSec} | ${answer}`;
  });

  return lines.join('\n');
}

/**
 * Build a system prompt snippet with past run context for a flow template.
 * Returns empty string if no history exists.
 */
export function formatWorkflowRunHistory(runHistory: string): string {
  if (!runHistory) return '';
  return (
    'Vergangene Ausführungen dieses Flow-Templates:\n' +
    runHistory + '\n' +
    'Nutze diese Informationen um bessere Entscheidungen zu treffen (z.B. Modell-Wahl, Vorgehensweise).'
  );
}
