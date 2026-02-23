// ============================================================================
// RAG Pipeline
// ============================================================================
// Semantic search over document embeddings + context injection for chat.
// Reuses embedQuery() and cosineSimilarity() from notes/embeddings.ts.
// ============================================================================

import {
  DocumentSearchResult,
  DocumentSummary,
  DocumentType,
  IndexStatus,
  RAGContext,
  SearchOptions,
  DocumentEmbeddingEntry,
} from './types';
import {
  DEFAULT_TOP_K,
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OLLAMA_HOST,
} from './constants';
import { loadDocuments, loadDocumentEmbeddings } from './store';
import { embedQuery, cosineSimilarity } from '../notes/embeddings';
import { Message } from '../../types/chat';

// ---------------------------------------------------------------------------
// Semantic Document Search
// ---------------------------------------------------------------------------

/**
 * Search documents by semantic similarity.
 *
 * @param query   Natural language query
 * @param options Search configuration
 * @returns Ranked array of matching chunks with scores
 */
export async function searchDocuments(
  query: string,
  options?: SearchOptions,
): Promise<DocumentSearchResult[]> {
  const topK = options?.topK ?? DEFAULT_TOP_K;
  const threshold = options?.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const model = options?.model ?? DEFAULT_EMBEDDING_MODEL;
  const host = options?.host ?? DEFAULT_OLLAMA_HOST;

  // Load all document embeddings
  const embeddings = await loadDocumentEmbeddings();
  if (embeddings.length === 0) return [];

  // Filter by documentIds if specified
  let filtered = embeddings;
  if (options?.documentIds && options.documentIds.length > 0) {
    const idSet = new Set(options.documentIds);
    filtered = embeddings.filter((e) => idSet.has(e.documentId));
  }

  // Filter by document types if specified
  let docs: Awaited<ReturnType<typeof loadDocuments>> = [];
  if (options?.types && options.types.length > 0) {
    docs = await loadDocuments();
    const typeSet = new Set(options.types);
    const allowedDocIds = new Set(
      docs.filter((d) => typeSet.has(d.type)).map((d) => d.id),
    );
    filtered = filtered.filter((e) => allowedDocIds.has(e.documentId));
  }

  if (filtered.length === 0) return [];

  // Embed the query
  const queryVector = await embedQuery(query, { host, model });

  // Score all chunks
  const scored: { entry: DocumentEmbeddingEntry; score: number }[] = [];
  for (const entry of filtered) {
    const score = cosineSimilarity(queryVector, entry.embedding);
    if (score >= threshold) {
      scored.push({ entry, score });
    }
  }

  // Sort by score descending and take top K
  scored.sort((a, b) => b.score - a.score);
  const topResults = scored.slice(0, topK);

  if (topResults.length === 0) return [];

  // Load document metadata for results
  if (docs.length === 0) {
    docs = await loadDocuments();
  }
  const docMap = new Map(docs.map((d) => [d.id, d]));

  // Build results
  return topResults.map(({ entry, score }) => {
    const doc = docMap.get(entry.documentId);
    const summary: DocumentSummary = doc
      ? {
          id: doc.id,
          name: doc.name,
          type: doc.type,
          size: doc.size,
          uploadedAt: doc.uploadedAt,
          indexedAt: doc.indexedAt,
          chunkCount: doc.chunkCount,
          status: doc.status,
          contentHash: doc.contentHash,
        }
      : {
          id: entry.documentId,
          name: 'Unbekanntes Dokument',
          type: DocumentType.TXT,
          size: 0,
          uploadedAt: '',
          indexedAt: null,
          chunkCount: 0,
          status: IndexStatus.Ready,
          contentHash: '',
        };

    return {
      chunk: {
        id: entry.id,
        documentId: entry.documentId,
        content: entry.chunk,
        index: parseInt(entry.id.split('#')[1] || '0', 10),
        createdAt: entry.createdAt,
      },
      document: summary,
      score,
    };
  });
}

// ---------------------------------------------------------------------------
// Build RAG Context
// ---------------------------------------------------------------------------

/**
 * Retrieve and assemble RAG context for a given query.
 *
 * @param query  The user's question
 * @param topK   Number of chunks to retrieve
 * @param options Additional search options
 * @returns RAGContext object ready for prompt injection
 */
export async function buildRAGContext(
  query: string,
  topK?: number,
  options?: SearchOptions,
): Promise<RAGContext & { searchResults: DocumentSearchResult[] }> {
  const results = await searchDocuments(query, {
    ...options,
    topK: topK ?? options?.topK ?? DEFAULT_TOP_K,
  });

  // Deduplicate source documents
  const sourceMap = new Map<string, DocumentSummary>();
  for (const r of results) {
    if (!sourceMap.has(r.document.id)) {
      sourceMap.set(r.document.id, r.document);
    }
  }

  return {
    chunks: results.map((r) => r.chunk),
    sources: Array.from(sourceMap.values()),
    query,
    totalMatches: results.length,
    searchResults: results,
  };
}

// ---------------------------------------------------------------------------
// Inject RAG Context into Messages
// ---------------------------------------------------------------------------

/**
 * Inject retrieved document context into the message array.
 * Prepends a system message with the relevant document excerpts
 * so the LLM can reference them when answering.
 *
 * @param messages  Current conversation messages
 * @param context   RAGContext from buildRAGContext()
 * @returns Modified message array with context injected
 */
export function injectRAGContext(
  messages: Message[],
  context: RAGContext,
  searchResults?: DocumentSearchResult[],
): Message[] {
  if (context.chunks.length === 0) return messages;

  // Build context block
  const contextParts: string[] = [
    '## Relevante Dokument-Auszüge',
    '',
    'Die folgenden Auszüge aus hochgeladenen Dokumenten sind relevant für die Frage des Nutzers.',
    'Nutze diese Informationen um die Frage zu beantworten. Verweise auf die Quellen.',
    '',
  ];

  for (let i = 0; i < context.chunks.length; i++) {
    const chunk = context.chunks[i];
    const source = context.sources.find((s) => s.id === chunk.documentId);
    const sourceName = source?.name || 'Unbekannt';
    const chunkRef = `${chunk.documentId}#${chunk.index}`;
    
    // Get actual similarity score from search results
    const searchResult = searchResults?.find(r => 
      r.chunk.id === chunk.id && r.chunk.documentId === chunk.documentId
    );
    const score = searchResult?.score ?? 0;
    const scorePercent = (score * 100).toFixed(1);

    // Structured reference for UI parsing
    contextParts.push(`### [QUELLE-${i + 1}: ${sourceName} | chunk:${chunkRef} | score:${scorePercent}%]`);
    contextParts.push('');
    contextParts.push(chunk.content);
    contextParts.push('');
  }

  contextParts.push('---');
  contextParts.push(
    `Quellen: ${context.sources.map((s) => s.name).join(', ')}`,
  );

  const contextMessage: Message = {
    id: `rag-context-${Date.now()}`,
    role: 'system',
    content: contextParts.join('\n'),
    timestamp: new Date(),
  };

  // Find the last system message index (if any) and insert after it
  const lastSystemIdx = messages.reduce(
    (acc, msg, idx) => (msg.role === 'system' ? idx : acc),
    -1,
  );

  const result = [...messages];
  result.splice(lastSystemIdx + 1, 0, contextMessage);

  return result;
}
