// ============================================================================
// Text → Tool-Call Fallback Parser
// ============================================================================
// When the LLM does NOT return structured tool_calls but writes JSON or
// function-call syntax in plain text, this module tries to extract
// usable tool calls from that text.
//
// Three strategies (tried in order):
//   1. JSON object with "name" + "arguments"/"parameters"
//   2. JSON object with tool name as key  { "write_file": { ... } }
//   3. Function-call syntax  write_file(key="val", ...)
// ============================================================================

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Try to parse a JSON string, returning null on failure.
 */
function tryParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Extract all top-level JSON objects from a string.
 * Handles objects that may be embedded in markdown code fences or prose.
 */
function extractJSONObjects(text: string): unknown[] {
  const results: unknown[] = [];

  // Strip markdown code fences
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');

  // Find all substrings that look like JSON objects
  let depth = 0;
  let start = -1;

  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (stripped[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = stripped.slice(start, i + 1);
        const parsed = tryParseJSON(candidate);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          results.push(parsed);
        }
        start = -1;
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Strategy 1: { "name": "tool_name", "arguments"|"parameters": { ... } }
// ---------------------------------------------------------------------------

function tryStrategy1(
  obj: Record<string, unknown>,
  knownToolNames: string[],
): ParsedToolCall | null {
  const name = obj.name;
  if (typeof name !== 'string' || !knownToolNames.includes(name)) return null;

  const args =
    (obj.arguments as Record<string, unknown>) ??
    (obj.parameters as Record<string, unknown>) ??
    {};

  if (typeof args !== 'object' || Array.isArray(args)) return null;

  return { name, arguments: args as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Strategy 2: { "write_file": { "path": "...", "content": "..." } }
// ---------------------------------------------------------------------------

function tryStrategy2(
  obj: Record<string, unknown>,
  knownToolNames: string[],
): ParsedToolCall | null {
  for (const key of Object.keys(obj)) {
    if (knownToolNames.includes(key)) {
      const args = obj[key];
      if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
        return { name: key, arguments: args as Record<string, unknown> };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Strategy 3: function-call syntax  tool_name(key="val", key2="val2")
// ---------------------------------------------------------------------------

function tryStrategy3(
  text: string,
  knownToolNames: string[],
): ParsedToolCall[] {
  const results: ParsedToolCall[] = [];

  for (const toolName of knownToolNames) {
    // Match: tool_name( ... )
    // Escape tool name in case it contains special regex chars (unlikely but safe)
    const escaped = toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped + '\\s*\\(([^)]*)\\)', 'g');

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const argsStr = match[1].trim();
      if (!argsStr) continue;

      const args: Record<string, unknown> = {};

      // Parse key=value or key="value" pairs
      // Handles: key="value", key='value', key=value
      const pairPattern = /(\w+)\s*[=:]\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/g;
      let pairMatch: RegExpExecArray | null;
      while ((pairMatch = pairPattern.exec(argsStr)) !== null) {
        const key = pairMatch[1];
        const value = pairMatch[2] ?? pairMatch[3] ?? pairMatch[4];
        args[key] = value;
      }

      if (Object.keys(args).length > 0) {
        results.push({ name: toolName, arguments: args });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to parse tool calls from plain text.
 *
 * Returns an empty array when no tool calls can be identified.
 * The caller should only use this as a fallback when the model did NOT
 * return structured `tool_calls`.
 */
export function parseToolCallsFromText(
  text: string,
  knownToolNames: string[],
): ParsedToolCall[] {
  if (!text || knownToolNames.length === 0) return [];

  const results: ParsedToolCall[] = [];
  const seen = new Set<string>(); // Avoid duplicates by serialised key

  // --- JSON-based strategies (1 & 2) ---
  const jsonObjects = extractJSONObjects(text);

  for (const obj of jsonObjects) {
    const record = obj as Record<string, unknown>;

    const fromS1 = tryStrategy1(record, knownToolNames);
    if (fromS1) {
      const key = JSON.stringify(fromS1);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(fromS1);
      }
      continue;
    }

    const fromS2 = tryStrategy2(record, knownToolNames);
    if (fromS2) {
      const key = JSON.stringify(fromS2);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(fromS2);
      }
    }
  }

  // --- Function-call syntax (strategy 3) ---
  // Only try if JSON strategies found nothing
  if (results.length === 0) {
    const fromS3 = tryStrategy3(text, knownToolNames);
    for (const call of fromS3) {
      const key = JSON.stringify(call);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(call);
      }
    }
  }

  return results;
}
