import { describe, expect, it } from 'vitest';
import type { SearchResult } from './types';
import { parseSelection } from './resultSelector';

function makeResults(): SearchResult[] {
  return [
    { title: 'One', url: 'https://example.com/1', content: 'A'.repeat(10), engine: 'x' },
    { title: 'Two', url: 'https://example.com/2', content: 'B'.repeat(10), engine: 'x' },
    { title: 'Three', url: 'https://example.com/3', content: 'C'.repeat(10), engine: 'x' },
  ];
}

describe('parseSelection', () => {
  it('parses NUMBER|REASON format', () => {
    const results = makeResults();
    expect(parseSelection('2|Because it best matches', results)).toEqual({
      selectedIndex: 1,
      title: 'Two',
      url: 'https://example.com/2',
      reason: 'Because it best matches',
    });
  });

  it('parses NUMBER|REASON format on a later line (multiline)', () => {
    const results = makeResults();
    expect(parseSelection('Some intro\n3|On line two', results)?.selectedIndex).toBe(2);
  });

  it('returns null for out-of-range selection in NUMBER|REASON', () => {
    const results = makeResults();
    expect(parseSelection('99|Nope', results)).toBeNull();
    expect(parseSelection('0|Nope', results)).toBeNull();
  });

  it('falls back to the first number in response with default reason', () => {
    const results = makeResults();
    expect(parseSelection('I pick 1 because...', results)).toEqual({
      selectedIndex: 0,
      title: 'One',
      url: 'https://example.com/1',
      reason: 'AI selection',
    });
  });

  it('returns null when no valid number is found', () => {
    const results = makeResults();
    expect(parseSelection('No selection given', results)).toBeNull();
  });
});

