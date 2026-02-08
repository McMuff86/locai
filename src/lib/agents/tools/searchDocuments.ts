// ============================================================================
// Built-in Tool: search_documents
// ============================================================================
// Semantic search over indexed documents using the RAG pipeline.
// ============================================================================

import { RegisteredTool, ToolResult } from '../types';
import { buildRAGContext } from '../../documents/rag';

const searchDocumentsTool: RegisteredTool = {
  definition: {
    name: 'search_documents',
    description:
      'Search through the user\'s indexed documents using semantic search. ' +
      'Returns relevant text chunks with source information. ' +
      'Use this when the user asks about their uploaded documents or files.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant document chunks',
        },
        topK: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
      },
      required: ['query'],
    },
    enabled: true,
    category: 'search',
  },

  handler: async (
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolResult> => {
    const callId = ''; // Will be overwritten by registry.execute
    const query = args.query as string | undefined;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return {
        callId,
        content: '',
        error:
          'Parameter "query" is required and must be a non-empty string. ' +
          'Expected: search_documents(query: "Suchbegriff"). ' +
          'You provided: ' + JSON.stringify(args),
        success: false,
      };
    }

    const topK =
      typeof args.topK === 'number' && args.topK > 0
        ? Math.min(args.topK, 20)
        : 5;

    try {
      const context = await buildRAGContext(query, topK);

      if (context.chunks.length === 0) {
        return {
          callId,
          content: `No relevant documents found for query: "${query}"`,
          success: true,
        };
      }

      // Format results for the model
      const parts: string[] = [
        `Found ${context.chunks.length} relevant chunk(s) from ${context.sources.length} document(s):`,
        '',
      ];

      for (let i = 0; i < context.chunks.length; i++) {
        const chunk = context.chunks[i];
        const source = context.sources.find((s) => s.id === chunk.documentId);
        const sourceName = source?.name ?? 'Unknown document';

        parts.push(`--- Chunk ${i + 1} (from: ${sourceName}) ---`);
        parts.push(chunk.content);
        parts.push('');
      }

      parts.push(
        `Sources: ${context.sources.map((s) => s.name).join(', ')}`,
      );

      return {
        callId,
        content: parts.join('\n'),
        success: true,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Document search failed';
      return {
        callId,
        content: '',
        error: message,
        success: false,
      };
    }
  },
};

export default searchDocumentsTool;
