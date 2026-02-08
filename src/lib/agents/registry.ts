// ============================================================================
// Tool Registry
// ============================================================================
// Central registry for agent tools. Manages registration, lookup,
// and execution of tools available to the agent executor.
// ============================================================================

import { OllamaTool } from '../ollama';
import {
  RegisteredTool,
  ToolCall,
  ToolResult,
  ToolCategory,
} from './types';
import { normalizeToolArgs } from './paramNormalizer';

// ---------------------------------------------------------------------------
// ToolRegistry Class
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  /**
   * Register a tool in the registry.
   * Throws if a tool with the same name is already registered.
   */
  register(tool: RegisteredTool): void {
    if (this.tools.has(tool.definition.name)) {
      throw new Error(`Tool "${tool.definition.name}" is already registered`);
    }
    this.tools.set(tool.definition.name, tool);
  }

  /**
   * Get a registered tool by name.
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check whether a tool with the given name exists.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Return all registered tools formatted as OllamaTool[] for the API call.
   * Optionally filtered to only include specific tool names.
   */
  list(enabledNames?: string[]): OllamaTool[] {
    const entries = enabledNames
      ? Array.from(this.tools.values()).filter(
          (t) =>
            enabledNames.includes(t.definition.name) &&
            t.definition.enabled !== false
        )
      : Array.from(this.tools.values()).filter(
          (t) => t.definition.enabled !== false
        );

    return entries.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.definition.name,
        description: t.definition.description,
        parameters: t.definition.parameters,
      },
    }));
  }

  /**
   * Return all registered tool names (for system prompt building).
   */
  listNames(enabledNames?: string[]): string[] {
    const entries = enabledNames
      ? Array.from(this.tools.values()).filter(
          (t) =>
            enabledNames.includes(t.definition.name) &&
            t.definition.enabled !== false
        )
      : Array.from(this.tools.values()).filter(
          (t) => t.definition.enabled !== false
        );
    return entries.map((t) => t.definition.name);
  }

  /**
   * List tools filtered by category, formatted as OllamaTool[].
   */
  listByCategory(category: ToolCategory): OllamaTool[] {
    return Array.from(this.tools.values())
      .filter(
        (t) =>
          t.definition.category === category && t.definition.enabled !== false
      )
      .map((t) => ({
        type: 'function' as const,
        function: {
          name: t.definition.name,
          description: t.definition.description,
          parameters: t.definition.parameters,
        },
      }));
  }

  /**
   * Return all registered tool definitions (for UI listing).
   */
  listDefinitions(enabledNames?: string[]) {
    const entries = enabledNames
      ? Array.from(this.tools.values()).filter((t) =>
          enabledNames.includes(t.definition.name)
        )
      : Array.from(this.tools.values());

    return entries.map((t) => t.definition);
  }

  /**
   * Execute a tool call and return the result.
   */
  async execute(
    call: ToolCall,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const tool = this.tools.get(call.name);

    if (!tool) {
      return {
        callId: call.id,
        content: '',
        error: `Unknown tool: "${call.name}"`,
        success: false,
      };
    }

    try {
      const normalizedArgs = normalizeToolArgs(call.name, call.arguments);
      const result = await tool.handler(normalizedArgs, signal);
      // Ensure callId matches
      return { ...result, callId: call.id };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Tool execution failed';
      return {
        callId: call.id,
        content: '',
        error: message,
        success: false,
      };
    }
  }

  /**
   * Remove all registered tools (useful for tests).
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Number of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const defaultRegistry = new ToolRegistry();
