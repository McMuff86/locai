import { describe, it, expect } from 'vitest';
import { normalizeToolArgs } from './paramNormalizer';

describe('normalizeToolArgs', () => {
  // -----------------------------------------------------------------------
  // write_file
  // -----------------------------------------------------------------------

  it('maps "title" → "path" for write_file', () => {
    const result = normalizeToolArgs('write_file', {
      title: 'test.txt',
      content: 'hello',
    });
    expect(result).toEqual({ path: 'test.txt', content: 'hello' });
  });

  it('maps "filename" → "path" for write_file', () => {
    const result = normalizeToolArgs('write_file', {
      filename: 'report.md',
      content: 'data',
    });
    expect(result).toEqual({ path: 'report.md', content: 'data' });
  });

  it('maps "body" → "content" for write_file', () => {
    const result = normalizeToolArgs('write_file', {
      path: 'file.txt',
      body: 'some text',
    });
    expect(result).toEqual({ path: 'file.txt', content: 'some text' });
  });

  it('does NOT overwrite existing canonical key', () => {
    const result = normalizeToolArgs('write_file', {
      title: 'wrong.txt',
      path: 'correct.txt',
      content: 'data',
    });
    // "path" already exists, so "title" alias should NOT replace it
    expect(result.path).toBe('correct.txt');
    // "title" stays since canonical already present
    expect(result.title).toBe('wrong.txt');
  });

  it('maps multiple aliases at once', () => {
    const result = normalizeToolArgs('write_file', {
      file: 'test.txt',
      text: 'content here',
    });
    expect(result).toEqual({ path: 'test.txt', content: 'content here' });
  });

  // -----------------------------------------------------------------------
  // read_file
  // -----------------------------------------------------------------------

  it('maps "file" → "path" for read_file', () => {
    const result = normalizeToolArgs('read_file', { file: 'data.csv' });
    expect(result).toEqual({ path: 'data.csv' });
  });

  it('maps "filepath" → "path" for read_file', () => {
    const result = normalizeToolArgs('read_file', { filepath: 'notes.md' });
    expect(result).toEqual({ path: 'notes.md' });
  });

  // -----------------------------------------------------------------------
  // edit_file
  // -----------------------------------------------------------------------

  it('maps "search" → "old_text" and "replace" → "new_text" for edit_file', () => {
    const result = normalizeToolArgs('edit_file', {
      file: 'doc.txt',
      search: 'old',
      replace: 'new',
    });
    expect(result).toEqual({ path: 'doc.txt', old_text: 'old', new_text: 'new' });
  });

  // -----------------------------------------------------------------------
  // create_note
  // -----------------------------------------------------------------------

  it('maps "name" → "title" for create_note', () => {
    const result = normalizeToolArgs('create_note', {
      name: 'My Note',
      content: 'body',
    });
    expect(result).toEqual({ title: 'My Note', content: 'body' });
  });

  it('maps "body" → "content" for create_note', () => {
    const result = normalizeToolArgs('create_note', {
      title: 'Note',
      body: 'the content',
    });
    expect(result).toEqual({ title: 'Note', content: 'the content' });
  });

  // -----------------------------------------------------------------------
  // run_command
  // -----------------------------------------------------------------------

  it('maps "cmd" → "command" for run_command', () => {
    const result = normalizeToolArgs('run_command', { cmd: 'ls -la' });
    expect(result).toEqual({ command: 'ls -la' });
  });

  // -----------------------------------------------------------------------
  // web_search & search_documents
  // -----------------------------------------------------------------------

  it('maps "q" → "query" for web_search', () => {
    const result = normalizeToolArgs('web_search', { q: 'test query' });
    expect(result).toEqual({ query: 'test query' });
  });

  it('maps "search" → "query" for search_documents', () => {
    const result = normalizeToolArgs('search_documents', { search: 'find this' });
    expect(result).toEqual({ query: 'find this' });
  });

  // -----------------------------------------------------------------------
  // Unknown tools
  // -----------------------------------------------------------------------

  it('passes through args unchanged for unknown tools', () => {
    const args = { foo: 'bar', baz: 42 };
    const result = normalizeToolArgs('unknown_tool', args);
    expect(result).toEqual(args);
  });

  it('does not mutate the original args object', () => {
    const original = { title: 'test.txt', content: 'hello' };
    const originalCopy = { ...original };
    normalizeToolArgs('write_file', original);
    expect(original).toEqual(originalCopy);
  });
});
