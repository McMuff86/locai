import { describe, expect, it } from 'vitest';
import { chunkText, cosineSimilarity } from './embeddings';

describe('chunkText', () => {
  it('returns [] for non-string or short input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('123456789')).toEqual([]);
    expect(chunkText((null as unknown) as string)).toEqual([]);
  });

  it('normalizes whitespace before chunking', () => {
    const chunks = chunkText('Hello   world\n\nthis\tis   spaced', 100, 0);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello world this is spaced');
  });

  it('respects overlap and produces deterministic chunk boundaries', () => {
    const text = 'a'.repeat(250);
    const chunks = chunkText(text, 100, 20);
    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(90);
    expect(chunks[3]).toHaveLength(20);
    expect(chunks[1].slice(0, 20)).toBe(chunks[0].slice(80));
    expect(chunks[2].slice(0, 20)).toBe(chunks[1].slice(80));
    expect(chunks[3]).toBe(chunks[2].slice(-20));
  });

  it('clamps chunkSize to a minimum of 100', () => {
    const text = 'b'.repeat(150);
    const chunks = chunkText(text, 20, 5);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(55);
    expect(chunks[2]).toHaveLength(5);
  });

  it('terminates with a safety limit for tiny progress settings', () => {
    const text = 'c'.repeat(20_000);
    const chunks = chunkText(text, 100, 10_000);
    expect(chunks.length).toBe(1000);
  });
});

describe('cosineSimilarity', () => {
  it('is ~1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 12);
  });

  it('is ~0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 12);
  });

  it('is 0 when one vector has zero norm', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it('uses the shared prefix length when vector lengths differ', () => {
    expect(cosineSimilarity([1, 0], [1, 0, 999])).toBeCloseTo(1, 12);
    expect(cosineSimilarity([1, 0], [0, 1, 999])).toBeCloseTo(0, 12);
  });
});
