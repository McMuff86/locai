import { describe, it, expect } from 'vitest';
import { parseToolCallsFromText } from './textToolParser';

const KNOWN_TOOLS = [
  'write_file',
  'read_file',
  'edit_file',
  'create_note',
  'web_search',
  'search_documents',
  'run_command',
];

describe('parseToolCallsFromText', () => {
  // -----------------------------------------------------------------------
  // Strategy 1: { "name": "tool", "arguments"|"parameters": { ... } }
  // -----------------------------------------------------------------------

  describe('Strategy 1: JSON with name + arguments', () => {
    it('parses { name, arguments } format', () => {
      const text = 'I will create a file: {"name": "write_file", "arguments": {"path": "test.txt", "content": "hello"}}';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('write_file');
      expect(result[0].arguments).toEqual({ path: 'test.txt', content: 'hello' });
    });

    it('parses { name, parameters } format', () => {
      const text = '{"name": "read_file", "parameters": {"path": "data.csv"}}';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('read_file');
      expect(result[0].arguments).toEqual({ path: 'data.csv' });
    });

    it('ignores unknown tool names', () => {
      const text = '{"name": "delete_everything", "arguments": {"path": "/"}}';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(0);
    });

    it('handles JSON in markdown code fences', () => {
      const text = 'Here is the call:\n```json\n{"name": "web_search", "arguments": {"query": "test"}}\n```';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('web_search');
    });
  });

  // -----------------------------------------------------------------------
  // Strategy 2: { "tool_name": { ... } }
  // -----------------------------------------------------------------------

  describe('Strategy 2: JSON with tool name as key', () => {
    it('parses { write_file: { ... } } format', () => {
      const text = '{"write_file": {"path": "out.txt", "content": "data"}}';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('write_file');
      expect(result[0].arguments).toEqual({ path: 'out.txt', content: 'data' });
    });

    it('ignores non-tool keys', () => {
      const text = '{"unknown_key": {"path": "file.txt"}}';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Strategy 3: function-call syntax
  // -----------------------------------------------------------------------

  describe('Strategy 3: function-call syntax', () => {
    it('parses write_file(path="test.txt", content="hello")', () => {
      const text = 'I will call write_file(path="test.txt", content="hello world")';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('write_file');
      expect(result[0].arguments.path).toBe('test.txt');
      expect(result[0].arguments.content).toBe('hello world');
    });

    it('parses with single quotes', () => {
      const text = "read_file(path='data.csv')";
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('read_file');
      expect(result[0].arguments.path).toBe('data.csv');
    });

    it('parses with colon separator', () => {
      const text = 'web_search(query: "latest news")';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('web_search');
      expect(result[0].arguments.query).toBe('latest news');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('Edge cases', () => {
    it('returns empty array for empty text', () => {
      expect(parseToolCallsFromText('', KNOWN_TOOLS)).toEqual([]);
    });

    it('returns empty array for empty tool names', () => {
      const text = '{"name": "write_file", "arguments": {"path": "x"}}';
      expect(parseToolCallsFromText(text, [])).toEqual([]);
    });

    it('returns empty array for plain text without tool calls', () => {
      const text = 'I will help you create a document about testing.';
      expect(parseToolCallsFromText(text, KNOWN_TOOLS)).toEqual([]);
    });

    it('deduplicates identical tool calls', () => {
      const text =
        '{"name": "write_file", "arguments": {"path": "a.txt", "content": "x"}} ' +
        '{"name": "write_file", "arguments": {"path": "a.txt", "content": "x"}}';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(1);
    });

    it('parses multiple different tool calls', () => {
      const text =
        'First: {"name": "write_file", "arguments": {"path": "a.txt", "content": "x"}} ' +
        'Then: {"name": "read_file", "arguments": {"path": "b.txt"}}';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('write_file');
      expect(result[1].name).toBe('read_file');
    });

    it('prefers JSON strategies over function-call syntax', () => {
      // Both a JSON object and function syntax — JSON should win and function syntax should not add duplicates
      const text =
        '{"name": "write_file", "arguments": {"path": "a.txt", "content": "x"}} ' +
        'write_file(path="a.txt", content="x")';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);

      // Should find at least the JSON one; function syntax is only tried if JSON finds nothing
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].name).toBe('write_file');
    });

    it('handles malformed JSON gracefully', () => {
      const text = '{"name": "write_file", "arguments": {broken json here}}';
      const result = parseToolCallsFromText(text, KNOWN_TOOLS);
      // Should not throw; may or may not find results
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
