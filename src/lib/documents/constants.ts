// ============================================================================
// Document RAG Constants & Configuration
// ============================================================================

import { DocumentType } from './types';

// ---------------------------------------------------------------------------
// Supported File Types
// ---------------------------------------------------------------------------

/**
 * Mapping of {@link DocumentType} to accepted MIME types.
 * Used for upload validation — a file is accepted if its MIME type
 * matches any entry for its detected document type.
 */
export const SUPPORTED_MIME_TYPES: Record<DocumentType, string[]> = {
  [DocumentType.PDF]: ['application/pdf'],
  [DocumentType.TXT]: ['text/plain'],
  [DocumentType.MD]: ['text/markdown', 'text/x-markdown', 'text/plain'],
  [DocumentType.CODE]: [
    'text/plain',
    'text/javascript',
    'text/typescript',
    'text/x-python',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++src',
    'text/x-rustsrc',
    'text/x-go',
    'text/css',
    'text/html',
    'text/xml',
    'application/json',
    'application/xml',
    'application/x-yaml',
    'application/x-sh',
  ],
  [DocumentType.DOCX]: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

/**
 * File extension to {@link DocumentType} mapping for auto-detection.
 * This is the primary detection mechanism — MIME type is used as fallback.
 * Extensions must include the leading dot and be lowercase.
 */
export const EXTENSION_TO_TYPE: Record<string, DocumentType> = {
  // PDF
  '.pdf': DocumentType.PDF,
  // Plain text
  '.txt': DocumentType.TXT,
  // Markdown
  '.md': DocumentType.MD,
  '.mdx': DocumentType.MD,
  // Code
  '.js': DocumentType.CODE,
  '.jsx': DocumentType.CODE,
  '.ts': DocumentType.CODE,
  '.tsx': DocumentType.CODE,
  '.py': DocumentType.CODE,
  '.java': DocumentType.CODE,
  '.c': DocumentType.CODE,
  '.cpp': DocumentType.CODE,
  '.h': DocumentType.CODE,
  '.hpp': DocumentType.CODE,
  '.rs': DocumentType.CODE,
  '.go': DocumentType.CODE,
  '.rb': DocumentType.CODE,
  '.php': DocumentType.CODE,
  '.swift': DocumentType.CODE,
  '.kt': DocumentType.CODE,
  '.cs': DocumentType.CODE,
  '.css': DocumentType.CODE,
  '.html': DocumentType.CODE,
  '.xml': DocumentType.CODE,
  '.json': DocumentType.CODE,
  '.yaml': DocumentType.CODE,
  '.yml': DocumentType.CODE,
  '.toml': DocumentType.CODE,
  '.sh': DocumentType.CODE,
  '.bash': DocumentType.CODE,
  '.zsh': DocumentType.CODE,
  '.sql': DocumentType.CODE,
  '.dockerfile': DocumentType.CODE,
  '.vue': DocumentType.CODE,
  '.svelte': DocumentType.CODE,
  // DOCX
  '.docx': DocumentType.DOCX,
};

// ---------------------------------------------------------------------------
// Chunk Configuration (per document type)
// ---------------------------------------------------------------------------

/**
 * Configuration for document chunking.
 * Each document type can have its own chunk size and overlap to optimize
 * embedding quality for different content structures.
 */
export interface ChunkConfig {
  /** Chunk size in characters */
  chunkSize: number;
  /** Overlap between adjacent chunks in characters */
  chunkOverlap: number;
}

/** Default chunking strategy per document type */
export const CHUNK_CONFIG: Record<DocumentType, ChunkConfig> = {
  [DocumentType.PDF]: { chunkSize: 500, chunkOverlap: 80 },
  [DocumentType.TXT]: { chunkSize: 500, chunkOverlap: 80 },
  [DocumentType.MD]: { chunkSize: 500, chunkOverlap: 80 },
  [DocumentType.CODE]: { chunkSize: 400, chunkOverlap: 60 },
  [DocumentType.DOCX]: { chunkSize: 500, chunkOverlap: 80 },
};

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Maximum file size for upload in bytes (20 MB) */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Maximum number of chunks per document (safety limit) */
export const MAX_CHUNKS_PER_DOCUMENT = 2000;

/** Maximum number of documents in the store */
export const MAX_DOCUMENTS = 500;

// ---------------------------------------------------------------------------
// Embedding Defaults
// ---------------------------------------------------------------------------

/** Default Ollama embedding model */
export const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

/** Default Ollama host */
export const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';

/** Embedding vector dimensions for nomic-embed-text */
export const EMBEDDING_DIMENSIONS = 768;

/** Maximum text length sent to the embedding model (chars) */
export const MAX_EMBED_TEXT_LENGTH = 8000;

/** Timeout for a single embedding request (ms) */
export const EMBED_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Search Defaults
// ---------------------------------------------------------------------------

/** Default number of top results returned */
export const DEFAULT_TOP_K = 5;

/** Default minimum similarity threshold */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.3;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** Filename for document metadata store */
export const DOCUMENTS_FILE = 'documents.json';

/** Filename for document embeddings (JSONL) */
export const DOCUMENT_EMBEDDINGS_FILE = 'document-embeddings.jsonl';

/** Sub-directory under the data path for uploaded document files */
export const UPLOADS_DIR = 'uploads';
