// ============================================================================
// Parameter Normalizer
// ============================================================================
// Corrects common parameter name mistakes made by open-source LLMs.
// Maps known aliases (e.g. "title" → "path" for write_file) to their
// canonical names BEFORE the tool handler is invoked.
// ============================================================================

/**
 * Per-tool mapping of alias → canonical parameter name.
 * Only aliases that are NOT already a valid parameter of the tool should
 * be listed here (the normalizer skips if the canonical key already exists).
 */
const PARAM_ALIASES: Record<string, Record<string, string>> = {
  write_file: {
    title: 'path',
    filename: 'path',
    file: 'path',
    name: 'path',
    file_path: 'path',
    filepath: 'path',
    text: 'content',
    body: 'content',
    data: 'content',
  },
  read_file: {
    title: 'path',
    filename: 'path',
    file: 'path',
    name: 'path',
    file_path: 'path',
    filepath: 'path',
  },
  edit_file: {
    filename: 'path',
    file: 'path',
    file_path: 'path',
    search: 'old_text',
    find: 'old_text',
    replace: 'new_text',
  },
  create_note: {
    name: 'title',
    heading: 'title',
    text: 'content',
    body: 'content',
  },
  run_command: {
    cmd: 'command',
    exec: 'command',
    shell: 'command',
  },
  web_search: {
    q: 'query',
    search: 'query',
    term: 'query',
  },
  search_documents: {
    q: 'query',
    search: 'query',
    term: 'query',
  },
};

/**
 * Normalise tool arguments by replacing known alias keys with canonical names.
 *
 * Rules:
 * - Only maps when the alias key is present AND the canonical key is absent.
 * - Returns a shallow copy; the original object is never mutated.
 * - Unknown tool names are passed through unchanged.
 */
export function normalizeToolArgs(
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const aliases = PARAM_ALIASES[toolName];
  if (!aliases) return args;

  const normalized = { ...args };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (alias in normalized && !(canonical in normalized)) {
      normalized[canonical] = normalized[alias];
      delete normalized[alias];
    }
  }
  return normalized;
}
