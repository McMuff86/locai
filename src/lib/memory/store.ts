// ============================================================================
// Memory Store
// ============================================================================
// Filesystem CRUD + keyword search + relevance scoring for agent memory.
// ============================================================================

import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { MemoryEntry, MemoryStore, MemoryLogEvent, MemoryCategory } from './types';
import { MAX_MEMORY_ENTRIES, MEMORY_SCHEMA_VERSION, MEMORY_FILE, MEMORY_LOG_FILE } from './constants';

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

  // Recency boost: entries updated within last 24h get +1
  const hoursAgo = (Date.now() - new Date(entry.updatedAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) score += 1;

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
 * Returns memories sorted by relevance score.
 */
export async function getRelevantMemories(
  message: string,
  limit: number = 10,
  basePath?: string,
): Promise<MemoryEntry[]> {
  return searchMemories(message, limit, basePath);
}

/**
 * Format memory entries for injection into system message.
 */
export function formatMemories(memories: MemoryEntry[]): string {
  return memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join('\n');
}
