// ============================================================================
// Agent Tool-Calling Types (Phase 2 Preparation)
// ============================================================================
// Type definitions for the Agent Mode tool-calling infrastructure.
// Compatible with Ollama's tool-calling API (v0.3+).
// ============================================================================

// ---------------------------------------------------------------------------
// JSON Schema subset for tool parameter definitions
// ---------------------------------------------------------------------------

/** JSON Schema type keywords used in tool parameter definitions */
export type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

/** Simplified JSON Schema for a single property */
export interface JSONSchemaProperty {
  type: JSONSchemaType;
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  default?: unknown;
}

/** Top-level JSON Schema for tool parameters (always type: "object") */
export interface ToolParametersSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

// ---------------------------------------------------------------------------
// Tool Definition (registered in the tool registry)
// ---------------------------------------------------------------------------

/** A tool that can be offered to the model via Ollama's tools API */
export interface ToolDefinition {
  /** Unique tool name (snake_case, e.g. "search_documents") */
  name: string;
  /** Human-readable description shown to the model */
  description: string;
  /** JSON Schema defining the expected parameters */
  parameters: ToolParametersSchema;
  /** Whether this tool is currently enabled */
  enabled?: boolean;
  /** Category for UI grouping */
  category?: ToolCategory;
}

/** Tool categories for UI organisation */
export type ToolCategory = 'search' | 'files' | 'code' | 'web' | 'notes' | 'media';

// ---------------------------------------------------------------------------
// Tool Call (model → runtime)
// ---------------------------------------------------------------------------

/** A tool invocation requested by the model */
export interface ToolCall {
  /** Unique call id (for matching calls to results) */
  id: string;
  /** Name of the tool to invoke (must match a registered ToolDefinition) */
  name: string;
  /** Parsed arguments from the model (validated against parameters schema) */
  arguments: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool Result (runtime → model)
// ---------------------------------------------------------------------------

/** The result of executing a tool, fed back to the model */
export interface ToolResult {
  /** Matches ToolCall.id */
  callId: string;
  /** Stringified result content (shown to the model) */
  content: string;
  /** If execution failed, the error message */
  error?: string;
  /** Whether the tool execution was successful */
  success: boolean;
}

// ---------------------------------------------------------------------------
// Agent Turn (full request/response cycle)
// ---------------------------------------------------------------------------

/** Represents one iteration of the agent loop */
export interface AgentTurn {
  /** Turn index within the current agent run (0-based) */
  index: number;
  /** Tool calls the model requested in this turn */
  toolCalls: ToolCall[];
  /** Results of executing those tool calls */
  toolResults: ToolResult[];
  /** Timestamp when this turn started */
  startedAt: string;
  /** Timestamp when this turn completed */
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Agent Execution Options
// ---------------------------------------------------------------------------

/** Configuration for the agent execution loop */
export interface AgentOptions {
  /** Maximum number of tool-call iterations per user message */
  maxIterations?: number;
  /** Timeout for the entire agent run in ms */
  timeoutMs?: number;
  /** Which tools are available for this run (defaults to all enabled) */
  enabledTools?: string[];
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/** Default agent execution limits */
export const AGENT_DEFAULTS = {
  /** Maximum tool-call rounds before forcing a final answer */
  maxIterations: 8,
  /** Overall timeout for agent run (2 minutes) */
  timeoutMs: 120_000,
} as const;

// ---------------------------------------------------------------------------
// Tool Handler (implementation signature)
// ---------------------------------------------------------------------------

/**
 * Function signature for a tool implementation.
 * Registered via the tool registry; called by the executor.
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<ToolResult>;

/** A fully registered tool: definition + handler */
export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
