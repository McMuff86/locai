// ============================================================================
// Document Chunker
// ============================================================================
// Splits parsed document text into chunks suitable for embedding.
// Type-aware: Markdown splits on headers, Code splits on function/class
// boundaries, PDF/TXT use paragraph-aware splitting.
// ============================================================================

import { DocumentType, DocumentChunk } from './types';
import { CHUNK_CONFIG, MAX_CHUNKS_PER_DOCUMENT } from './constants';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Trim and discard chunks that are too short to be useful.
 *
 * @param chunks    Raw string chunks to filter
 * @param minLength Minimum character length to keep a chunk (default: 20)
 * @returns Filtered and trimmed array of chunks
 */
function filterChunks(chunks: string[], minLength = 20): string[] {
  return chunks
    .map((c) => c.trim())
    .filter((c) => c.length >= minLength);
}

/**
 * Sliding-window chunker (fallback / sub-chunker).
 * Mirrors the logic in notes/embeddings.ts chunkText() but operates on
 * pre-split sections.
 */
function slidingWindowChunk(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  if (!text || text.trim().length < 10) return [];

  const clean = text.replace(/\s+/g, ' ').trim();
  const safeChunkSize = Math.max(100, Math.min(chunkSize, 10000));
  const safeOverlap = Math.max(0, Math.min(overlap, safeChunkSize - 10));

  const chunks: string[] = [];
  let start = 0;
  let iterations = 0;
  const maxIterations = 5000;

  while (start < clean.length && iterations < maxIterations) {
    iterations++;
    const end = Math.min(start + safeChunkSize, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);

    const next = end - safeOverlap;
    start = next <= start ? end : next;
    if (start >= clean.length) break;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Markdown-aware chunking
// ---------------------------------------------------------------------------

/**
 * Split markdown text by header boundaries, then sub-chunk large sections.
 * Falls back to paragraph splitting if no headers are found.
 *
 * @param text       Markdown content
 * @param chunkSize  Target chunk size in characters
 * @param overlap    Character overlap between chunks
 * @returns Array of text chunks
 */
function chunkMarkdown(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  // Split on markdown headers (## or #)
  const headerPattern = /^(#{1,6}\s+.+)$/gm;
  const sections: string[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(headerPattern)) {
    const idx = match.index!;
    if (idx > lastIndex) {
      sections.push(text.slice(lastIndex, idx));
    }
    lastIndex = idx;
  }
  // Remaining text after last header
  if (lastIndex < text.length) {
    sections.push(text.slice(lastIndex));
  }

  // If no headers found, fall back to paragraph splitting
  if (sections.length <= 1) {
    return chunkParagraphs(text, chunkSize, overlap);
  }

  // Sub-chunk sections that are too large
  const result: string[] = [];
  for (const section of sections) {
    if (section.trim().length <= chunkSize) {
      if (section.trim().length > 0) result.push(section.trim());
    } else {
      result.push(...slidingWindowChunk(section, chunkSize, overlap));
    }
  }

  return filterChunks(result);
}

// ---------------------------------------------------------------------------
// Code-aware chunking
// ---------------------------------------------------------------------------

/**
 * Splits code at function / class / block boundaries.
 * Falls back to sliding window for files without clear boundaries.
 */
function chunkCode(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  // Patterns that typically start a new logical block
  const blockPatterns = [
    /^(export\s+)?(async\s+)?function\s+/m, // function declarations
    /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/m, // arrow functions
    /^(export\s+)?(abstract\s+)?class\s+/m, // class declarations
    /^(export\s+)?interface\s+/m, // TS interfaces
    /^(export\s+)?type\s+/m, // TS type aliases
    /^(export\s+)?enum\s+/m, // TS enums
    /^def\s+/m, // Python functions
    /^class\s+/m, // Python classes
    /^func\s+/m, // Go functions
    /^fn\s+/m, // Rust functions
    /^impl\s+/m, // Rust impl blocks
    /^pub\s+(fn|struct|enum|trait)\s+/m, // Rust pub items
  ];

  // Combine into a mega-pattern for splitting
  const combinedPattern =
    /^(?:(?:export\s+)?(?:async\s+)?function\s+|(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|(?:export\s+)?(?:abstract\s+)?class\s+|(?:export\s+)?interface\s+|(?:export\s+)?type\s+\w|(?:export\s+)?enum\s+|def\s+|func\s+|fn\s+|impl\s+|pub\s+(?:fn|struct|enum|trait)\s+)/m;

  const lines = text.split('\n');
  const sections: string[] = [];
  let currentSection: string[] = [];

  for (const line of lines) {
    if (combinedPattern.test(line) && currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
      currentSection = [];
    }
    currentSection.push(line);
  }
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }

  // If we couldn't split meaningfully, use sliding window
  if (sections.length <= 1) {
    return slidingWindowChunk(text, chunkSize, overlap);
  }

  // Sub-chunk sections that are too large
  const result: string[] = [];
  for (const section of sections) {
    if (section.trim().length <= chunkSize) {
      if (section.trim().length > 0) result.push(section.trim());
    } else {
      result.push(...slidingWindowChunk(section, chunkSize, overlap));
    }
  }

  return filterChunks(result);
}

// ---------------------------------------------------------------------------
// Paragraph-aware chunking (PDF / TXT)
// ---------------------------------------------------------------------------

/**
 * Split text at paragraph boundaries (double newlines), merging short
 * paragraphs and sub-chunking long ones via sliding window.
 *
 * @param text       Plain text content
 * @param chunkSize  Target chunk size in characters
 * @param overlap    Character overlap between chunks
 * @returns Array of text chunks
 */
function chunkParagraphs(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  // Split on double newlines (paragraphs)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    return slidingWindowChunk(text, chunkSize, overlap);
  }

  // Merge short paragraphs, split long ones
  const result: string[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    if (buffer.length + para.length + 2 <= chunkSize) {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    } else {
      // Flush buffer
      if (buffer.length > 0) {
        result.push(buffer);
      }
      // If this paragraph alone is too long, sub-chunk it
      if (para.length > chunkSize) {
        result.push(...slidingWindowChunk(para, chunkSize, overlap));
        buffer = '';
      } else {
        buffer = para;
      }
    }
  }

  if (buffer.length > 0) {
    result.push(buffer);
  }

  return filterChunks(result);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Split document text into chunks based on its type.
 *
 * @param text         Parsed plain-text content
 * @param documentId   ID of the parent document (used for chunk IDs)
 * @param type         Document type for strategy selection
 * @param options      Optional override for chunk size / overlap
 * @returns Array of DocumentChunk objects (without embeddings)
 */
export function chunkDocument(
  text: string,
  documentId: string,
  type: DocumentType,
  options?: ChunkOptions,
): DocumentChunk[] {
  const config = CHUNK_CONFIG[type] || CHUNK_CONFIG[DocumentType.TXT];
  const chunkSize = options?.chunkSize ?? config.chunkSize;
  const chunkOverlap = options?.chunkOverlap ?? config.chunkOverlap;

  let rawChunks: string[];

  switch (type) {
    case DocumentType.MD:
      rawChunks = chunkMarkdown(text, chunkSize, chunkOverlap);
      break;
    case DocumentType.CODE:
      rawChunks = chunkCode(text, chunkSize, chunkOverlap);
      break;
    case DocumentType.PDF:
    case DocumentType.TXT:
    default:
      rawChunks = chunkParagraphs(text, chunkSize, chunkOverlap);
      break;
  }

  // Safety limit
  if (rawChunks.length > MAX_CHUNKS_PER_DOCUMENT) {
    console.warn(
      `[Chunker] Document ${documentId} produced ${rawChunks.length} chunks, truncating to ${MAX_CHUNKS_PER_DOCUMENT}`,
    );
    rawChunks = rawChunks.slice(0, MAX_CHUNKS_PER_DOCUMENT);
  }

  const now = new Date().toISOString();

  return rawChunks.map((content, index) => ({
    id: `${documentId}#${index}`,
    documentId,
    content,
    index,
    createdAt: now,
  }));
}
