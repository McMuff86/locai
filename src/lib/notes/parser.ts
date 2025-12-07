const WIKILINK_REGEX = /\[\[([^[\]]+)\]\]/g;
const TAG_REGEX = /(^|\s)#([a-zA-Z0-9/_-]+)/g;

export function extractLinksAndTags(content: string): { links: string[]; tags: string[] } {
  const links = new Set<string>();
  const tags = new Set<string>();

  for (const match of content.matchAll(WIKILINK_REGEX)) {
    const value = match[1].trim();
    if (value) links.add(value);
  }

  for (const match of content.matchAll(TAG_REGEX)) {
    const value = match[2].trim();
    if (value) tags.add(value);
  }

  return {
    links: Array.from(links),
    tags: Array.from(tags),
  };
}


