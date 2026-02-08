// ============================================================================
// Built-in Tool: recall_memory
// ============================================================================
// Allows the agent to search and recall stored memories about the user.
// ============================================================================

import { RegisteredTool, ToolResult } from '../types';
import { searchMemories, listMemories } from '../../memory/store';

const recallMemoryTool: RegisteredTool = {
  definition: {
    name: 'recall_memory',
    description:
      'Search through saved memories about the user. ' +
      'Use this to recall previously saved information like user preferences, ' +
      'personal details, project context, or instructions. ' +
      'If no query is provided, lists recent memories.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find relevant memories (optional — if empty, returns recent memories)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
      required: [],
    },
    enabled: true,
    category: 'notes',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const query = args.query as string | undefined;
    const limit = typeof args.limit === 'number' && args.limit > 0
      ? Math.min(args.limit, 50)
      : 10;

    try {
      const memories = query?.trim()
        ? await searchMemories(query, limit)
        : await listMemories();

      const results = memories.slice(0, limit);

      if (results.length === 0) {
        return {
          callId,
          content: query
            ? `No memories found matching "${query}"`
            : 'No memories stored yet',
          success: true,
        };
      }

      const formatted = results.map(m =>
        `[${m.category}] ${m.key}: ${m.value}${m.tags?.length ? ` (tags: ${m.tags.join(', ')})` : ''}`
      ).join('\n');

      return {
        callId,
        content: `Found ${results.length} memory/memories:\n${formatted}`,
        success: true,
      };
    } catch (err) {
      return {
        callId,
        content: '',
        error: err instanceof Error ? err.message : 'Failed to recall memories',
        success: false,
      };
    }
  },
};

export default recallMemoryTool;
