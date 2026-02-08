// ============================================================================
// Built-in Tool: web_search
// ============================================================================
// Web search using the existing SearXNG / DuckDuckGo integration.
// ============================================================================

import { RegisteredTool, ToolResult } from '../types';
import { searchWeb } from '../../webSearch/searxng';

const webSearchTool: RegisteredTool = {
  definition: {
    name: 'web_search',
    description:
      'Search the web for current information using DuckDuckGo / SearXNG. ' +
      'Returns search result titles, URLs, and snippets. ' +
      'Use this when the user asks about recent events, facts you are unsure about, or anything that benefits from up-to-date web information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
      },
      required: ['query'],
    },
    enabled: true,
    category: 'web',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = '';
    const query = args.query as string | undefined;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return {
        callId,
        content: '',
        error:
          'Parameter "query" is required and must be a non-empty string. ' +
          'Expected: web_search(query: "Suchbegriff"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    try {
      const searchResponse = await searchWeb(query.trim(), {
        maxResults: 8,
        timeout: 10000,
        language: 'de-DE',
      });

      if (searchResponse.error) {
        return {
          callId,
          content: '',
          error: `Web search failed: ${searchResponse.error}`,
          success: false,
        };
      }

      if (searchResponse.results.length === 0) {
        return {
          callId,
          content: `No web results found for: "${query}"`,
          success: true,
        };
      }

      // Format results for the model
      const parts: string[] = [
        `Web search results for "${query}" (${searchResponse.results.length} results):`,
        '',
      ];

      for (let i = 0; i < searchResponse.results.length; i++) {
        const r = searchResponse.results[i];
        parts.push(`[${i + 1}] ${r.title}`);
        parts.push(`    URL: ${r.url}`);
        if (r.content) {
          parts.push(`    ${r.content}`);
        }
        parts.push('');
      }

      return {
        callId,
        content: parts.join('\n'),
        success: true,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Web search failed';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default webSearchTool;
