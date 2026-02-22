// ============================================================================
// Built-in Tool Names (client-safe)
// ============================================================================
// Pure data – no server-side dependencies.
// Import this file wherever you need the list of built-in tool names
// (including client components like ConfigPanel).
// ============================================================================

export const BUILTIN_TOOL_NAMES = [
  'search_documents',
  'web_search',
  'read_file',
  'write_file',
  'edit_file',
  'create_note',
  'save_memory',
  'recall_memory',
  'run_command',
  'run_code',
  'generate_image',
  'read_pdf',
  'read_excel',
] as const;

export type BuiltinToolName = (typeof BUILTIN_TOOL_NAMES)[number];
