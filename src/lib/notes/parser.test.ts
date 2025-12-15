import { describe, expect, it } from 'vitest';
import { extractLinksAndTags } from './parser';

describe('extractLinksAndTags', () => {
  it('extracts unique wikilinks and tags', () => {
    const input = 'See [[Alpha]] and [[Beta]]. Tags: #one #two #one';
    expect(extractLinksAndTags(input)).toEqual({
      links: ['Alpha', 'Beta'],
      tags: ['one', 'two'],
    });
  });

  it('trims wikilink values and ignores empty wikilinks', () => {
    const input = '[[  Hello World  ]] [[   ]]';
    expect(extractLinksAndTags(input)).toEqual({
      links: ['Hello World'],
      tags: [],
    });
  });

  it('keeps full wikilink payload including pipes', () => {
    const input = '[[Page|Alias]]';
    expect(extractLinksAndTags(input)).toEqual({
      links: ['Page|Alias'],
      tags: [],
    });
  });

  it('extracts tags at line start and across newlines', () => {
    const input = '#start\nText with #middle\nEnd #last';
    expect(extractLinksAndTags(input).tags).toEqual(['start', 'middle', 'last']);
  });

  it('does not treat punctuation-prefixed # as a tag', () => {
    const input = 'foo(#nope) bar.#stillNope ok #yes';
    expect(extractLinksAndTags(input).tags).toEqual(['yes']);
  });

  it('supports allowed tag characters (/, _, -) and stops at invalid chars', () => {
    const input = 'Tags: #a_b-c #path/to/tag #tag, #tag.';
    expect(extractLinksAndTags(input).tags).toEqual(['a_b-c', 'path/to/tag', 'tag']);
  });
});

