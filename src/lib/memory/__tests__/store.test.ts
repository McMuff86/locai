import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  saveMemory,
  listMemories,
  searchMemories,
  deleteMemory,
  getRelevantMemories,
  pruneMemories,
  loadMemoryStore,
} from '@/lib/memory/store';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'locai-mem-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('saveMemory', () => {
  it('creates entry with correct fields', async () => {
    const entry = await saveMemory(
      { key: 'user_name', value: 'Alice', category: 'fact', tags: ['user'], source: 'conv-1' },
      tmpDir,
    );

    expect(entry.id).toBeDefined();
    expect(entry.key).toBe('user_name');
    expect(entry.value).toBe('Alice');
    expect(entry.category).toBe('fact');
    expect(entry.tags).toEqual(['user']);
    expect(entry.source).toBe('conv-1');
    expect(entry.createdAt).toBeDefined();
    expect(entry.updatedAt).toBeDefined();
  });

  it('updates existing entry by key', async () => {
    await saveMemory({ key: 'name', value: 'Alice', category: 'fact' }, tmpDir);
    const updated = await saveMemory({ key: 'name', value: 'Bob', category: 'fact' }, tmpDir);

    expect(updated.value).toBe('Bob');
    const all = await listMemories(tmpDir);
    expect(all).toHaveLength(1);
  });
});

describe('listMemories', () => {
  it('returns all entries sorted by updatedAt desc', async () => {
    await saveMemory({ key: 'a', value: '1', category: 'fact' }, tmpDir);
    await saveMemory({ key: 'b', value: '2', category: 'preference' }, tmpDir);
    await saveMemory({ key: 'c', value: '3', category: 'instruction' }, tmpDir);

    const all = await listMemories(tmpDir);
    expect(all).toHaveLength(3);
    // Most recently updated first
    expect(all[0].key).toBe('c');
  });

  it('returns empty array for fresh store', async () => {
    const all = await listMemories(tmpDir);
    expect(all).toEqual([]);
  });
});

describe('searchMemories', () => {
  it('finds entries by keyword in key', async () => {
    await saveMemory({ key: 'favorite_color', value: 'blue', category: 'preference' }, tmpDir);
    await saveMemory({ key: 'user_name', value: 'Alice', category: 'fact' }, tmpDir);

    const results = await searchMemories('color', 10, tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('favorite_color');
  });

  it('finds entries by keyword in value', async () => {
    await saveMemory({ key: 'note', value: 'loves typescript', category: 'fact' }, tmpDir);

    const results = await searchMemories('typescript', 10, tmpDir);
    expect(results).toHaveLength(1);
  });

  it('finds entries by tag', async () => {
    await saveMemory({ key: 'x', value: 'y', category: 'fact', tags: ['coding'] }, tmpDir);

    const results = await searchMemories('coding', 10, tmpDir);
    expect(results).toHaveLength(1);
  });

  it('returns empty for no match', async () => {
    await saveMemory({ key: 'a', value: 'b', category: 'fact' }, tmpDir);
    const results = await searchMemories('zzzznotfound', 10, tmpDir);
    expect(results).toEqual([]);
  });
});

describe('deleteMemory', () => {
  it('removes entry by id', async () => {
    const entry = await saveMemory({ key: 'del_me', value: 'gone', category: 'fact' }, tmpDir);
    const deleted = await deleteMemory(entry.id, tmpDir);
    expect(deleted).toBe(true);

    const all = await listMemories(tmpDir);
    expect(all).toHaveLength(0);
  });

  it('returns false for non-existent id', async () => {
    const deleted = await deleteMemory('nonexistent-id', tmpDir);
    expect(deleted).toBe(false);
  });
});

describe('getRelevantMemories', () => {
  it('falls back to keyword search when no embeddings', async () => {
    await saveMemory({ key: 'coding_style', value: 'functional typescript', category: 'preference' }, tmpDir);
    await saveMemory({ key: 'pet', value: 'cat named Luna', category: 'fact' }, tmpDir);

    const results = await getRelevantMemories('typescript', 10, tmpDir);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.key === 'coding_style')).toBe(true);
  });

  it('respects token budget', async () => {
    // Create many entries with long values
    for (let i = 0; i < 50; i++) {
      await saveMemory(
        { key: `topic_${i}`, value: `keyword ${'x'.repeat(200)}`, category: 'fact' },
        tmpDir,
      );
    }

    const results = await getRelevantMemories('keyword', 50, tmpDir);
    // Should be limited by ~2000 token budget
    expect(results.length).toBeLessThan(50);
  });
});

describe('pruneMemories', () => {
  it('removes entries older than 30 days without access', async () => {
    // Directly write a store with old entries
    const store = await loadMemoryStore(tmpDir);
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    store.entries.push({
      id: 'old-1',
      key: 'old_entry',
      value: 'should be pruned',
      category: 'fact',
      createdAt: oldDate,
      updatedAt: oldDate,
    });
    store.entries.push({
      id: 'new-1',
      key: 'new_entry',
      value: 'should stay',
      category: 'fact',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Write store directly
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'memory.json'), JSON.stringify(store, null, 2), 'utf-8');

    const result = await pruneMemories(tmpDir);
    expect(result.archived).toBe(1);
    expect(result.remaining).toBe(1);
    expect(result.archivedIds).toContain('old-1');

    const remaining = await listMemories(tmpDir);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('new-1');
  });

  it('does nothing when no entries are old', async () => {
    await saveMemory({ key: 'recent', value: 'still fresh', category: 'fact' }, tmpDir);

    const result = await pruneMemories(tmpDir);
    expect(result.archived).toBe(0);
    expect(result.remaining).toBe(1);
  });
});
