// ============================================================================
// Built-in Tool: save_memory
// ============================================================================
// Allows the agent to persist information about the user for future sessions.
// ============================================================================

import { RegisteredTool, ToolResult } from '../types';
import { saveMemory } from '../../memory/store';
import type { MemoryCategory } from '../../memory/types';

const VALID_CATEGORIES: MemoryCategory[] = ['fact', 'preference', 'project_context', 'instruction'];

const saveMemoryTool: RegisteredTool = {
  definition: {
    name: 'save_memory',
    description:
      'Save a piece of information about the user for future conversations. ' +
      'Use this when the user shares personal details, preferences, project context, ' +
      'or explicit instructions that should be remembered across sessions. ' +
      'Categories: "fact" (personal info), "preference" (likes/dislikes), ' +
      '"project_context" (project details), "instruction" (how to behave).',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Short identifier for this memory (e.g. "user_name", "preferred_language", "project_stack")',
        },
        value: {
          type: 'string',
          description: 'The information to remember',
        },
        category: {
          type: 'string',
          description: 'Category: "fact", "preference", "project_context", or "instruction"',
          enum: ['fact', 'preference', 'project_context', 'instruction'],
        },
        tags: {
          type: 'array',
          description: 'Optional tags for better retrieval',
          items: { type: 'string' },
        },
      },
      required: ['key', 'value', 'category'],
    },
    enabled: true,
    category: 'notes',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const key = args.key as string | undefined;
    const value = args.value as string | undefined;
    const category = args.category as string | undefined;
    const tags = Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === 'string') : undefined;

    if (!key || !value || !category) {
      return {
        callId,
        content: '',
        error: 'Parameters "key", "value", and "category" are required',
        success: false,
      };
    }

    if (!VALID_CATEGORIES.includes(category as MemoryCategory)) {
      return {
        callId,
        content: '',
        error: `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        success: false,
      };
    }

    try {
      const entry = await saveMemory({
        key,
        value,
        category: category as MemoryCategory,
        tags,
      });

      return {
        callId,
        content: `Memory saved: "${key}" = "${value}" [${category}] (ID: ${entry.id})`,
        success: true,
      };
    } catch (err) {
      return {
        callId,
        content: '',
        error: err instanceof Error ? err.message : 'Failed to save memory',
        success: false,
      };
    }
  },
};

export default saveMemoryTool;
