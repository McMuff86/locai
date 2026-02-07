// ============================================================================
// Document RAG Types
// ============================================================================
// Core type definitions for the document upload, indexing, and RAG pipeline.
// Builds on the existing notes/types.ts embedding system.
// ============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Supported document types for upload and processing */
export enum DocumentType {
  PDF = 'pdf',
  TXT = 'txt',
  MD = 'md',
  CODE = 'code',
  DOCX = 'docx',
}

/** Lifecycle status of a document's embedding index */
export enum IndexStatus {
  /** Uploaded but not yet queued for indexing */
  Pending = 'pending',
  /** Currently being chunked + embedded */
  Indexing = 'indexing',
  /** Fully indexed, searchable */
  Ready = 'ready',
  /** Indexing failed – see Document.error */
  Error = 'error',
}

// ---------------------------------------------------------------------------
// Core Entities
// ---------------------------------------------------------------------------

/** A user-uploaded document with its processing metadata */
export interface Document {
  /** Unique identifier (nanoid) */
  id: string;
  /** Original filename as uploaded */
  name: string;
  /** Detected document type */
  type: DocumentType;
  /** File size in bytes */
  size: number;
  /** ISO-8601 upload timestamp */
  uploadedAt: string;
  /** ISO-8601 timestamp of last re-index (null if never completed) */
  indexedAt: string | null;
  /** Number of chunks generated from this document */
  chunkCount: number;
  /** Current indexing status */
  status: IndexStatus;
  /** Human-readable error message when status === Error */
  error?: string;
  /** SHA-256 hash of file content for dedup / change detection */
  contentHash: string;
}

/** Compact listing variant without heavy fields */
export type DocumentSummary = Omit<Document, 'error'>;

/** A single chunk extracted from a document */
export interface DocumentChunk {
  /** Unique chunk id: `${documentId}#${index}` */
  id: string;
  /** Parent document id */
  documentId: string;
  /** The text content of this chunk */
  content: string;
  /** Zero-based chunk index within the document */
  index: number;
  /** Embedding vector (omitted in listings, present in store) */
  embedding?: number[];
  /** Embedding model used to generate the vector */
  model?: string;
  /** ISO-8601 timestamp when this chunk was embedded */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Search & RAG
// ---------------------------------------------------------------------------

/** A single search hit returned by semantic document search */
export interface DocumentSearchResult {
  /** The matched chunk */
  chunk: DocumentChunk;
  /** Parent document metadata */
  document: DocumentSummary;
  /** Cosine similarity score (0–1) */
  score: number;
  /** Highlighted excerpt with search terms marked (optional) */
  highlight?: string;
}

/** Context object assembled by the RAG pipeline and injected into the prompt */
export interface RAGContext {
  /** Top-K chunks selected as context */
  chunks: DocumentChunk[];
  /** Source documents referenced (deduplicated) */
  sources: DocumentSummary[];
  /** The original user query that triggered retrieval */
  query: string;
  /** Total number of chunks evaluated before top-K selection */
  totalMatches: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for the document upload endpoint */
export interface UploadOptions {
  /** Override auto-detected document type */
  type?: DocumentType;
  /** Custom chunk size in characters (overrides per-type default) */
  chunkSize?: number;
  /** Custom chunk overlap in characters */
  chunkOverlap?: number;
  /** Embedding model to use (defaults to nomic-embed-text) */
  model?: string;
  /** Ollama host URL */
  host?: string;
}

/** Options for semantic document search */
export interface SearchOptions {
  /** Maximum number of results to return */
  topK?: number;
  /** Minimum cosine similarity threshold (0–1) */
  threshold?: number;
  /** Filter by specific document IDs */
  documentIds?: string[];
  /** Filter by document type */
  types?: DocumentType[];
  /** Embedding model (must match what was used for indexing) */
  model?: string;
  /** Ollama host URL */
  host?: string;
}

// ---------------------------------------------------------------------------
// Store / Persistence
// ---------------------------------------------------------------------------

/** Shape of a single line in the document embeddings JSONL store */
export interface DocumentEmbeddingEntry {
  /** Chunk id: `${documentId}#${index}` */
  id: string;
  /** Parent document id */
  documentId: string;
  /** Chunk text */
  chunk: string;
  /** Embedding vector */
  embedding: number[];
  /** Model used */
  model: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
}
