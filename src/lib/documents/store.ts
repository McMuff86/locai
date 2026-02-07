// ============================================================================
// Document Store
// ============================================================================
// JSONL-based persistence for document metadata and embeddings.
// Mirrors the pattern from notes/embeddings.ts but keeps document data
// separate (documents.json + document-embeddings.jsonl).
// ============================================================================

import path from 'path';
import { promises as fs } from 'fs';
import {
  Document,
  DocumentChunk,
  DocumentEmbeddingEntry,
  IndexStatus,
} from './types';
import {
  DOCUMENTS_FILE,
  DOCUMENT_EMBEDDINGS_FILE,
  UPLOADS_DIR,
} from './constants';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Get the default storage root for document data.
 * Uses `~/.locai/documents` by default.
 */
function defaultStoragePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  return path.join(home, '.locai', 'documents');
}

/**
 * Resolve the storage base path, using the custom path if provided,
 * otherwise falling back to the default (~/.locai/documents).
 *
 * @param customPath  Optional custom storage directory
 * @returns Resolved absolute path
 */
export function getStoragePath(customPath?: string): string {
  return customPath || defaultStoragePath();
}

function documentsFilePath(basePath: string): string {
  return path.join(basePath, DOCUMENTS_FILE);
}

function embeddingsFilePath(basePath: string): string {
  return path.join(basePath, DOCUMENT_EMBEDDINGS_FILE);
}

function uploadsDir(basePath: string): string {
  return path.join(basePath, UPLOADS_DIR);
}

// ---------------------------------------------------------------------------
// Ensure directory structure
// ---------------------------------------------------------------------------

async function ensureDirs(basePath: string): Promise<void> {
  await fs.mkdir(basePath, { recursive: true });
  await fs.mkdir(uploadsDir(basePath), { recursive: true });
}

// ---------------------------------------------------------------------------
// Document metadata (JSON array file)
// ---------------------------------------------------------------------------

/**
 * Load all document metadata from the store.
 */
export async function loadDocuments(basePath?: string): Promise<Document[]> {
  const storagePath = getStoragePath(basePath);
  const filePath = documentsFilePath(storagePath);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Document[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('[DocStore] Failed to load documents:', err);
    return [];
  }
}

/**
 * Save the full documents array (overwrite).
 */
async function saveDocumentsArray(
  basePath: string,
  docs: Document[],
): Promise<void> {
  await ensureDirs(basePath);
  const filePath = documentsFilePath(basePath);
  await fs.writeFile(filePath, JSON.stringify(docs, null, 2), 'utf-8');
}

/**
 * Save or update a single document's metadata.
 */
export async function saveDocument(
  doc: Document,
  basePath?: string,
): Promise<void> {
  const storagePath = getStoragePath(basePath);
  const existing = await loadDocuments(storagePath);

  const idx = existing.findIndex((d) => d.id === doc.id);
  if (idx >= 0) {
    existing[idx] = doc;
  } else {
    existing.push(doc);
  }

  await saveDocumentsArray(storagePath, existing);
}

/**
 * Get a single document by ID.
 */
export async function getDocument(
  id: string,
  basePath?: string,
): Promise<Document | null> {
  const docs = await loadDocuments(basePath);
  return docs.find((d) => d.id === id) || null;
}

/**
 * Delete a document and its associated embeddings + uploaded file.
 */
export async function deleteDocument(
  id: string,
  basePath?: string,
): Promise<boolean> {
  // Validate ID format (must be safe for filesystem use)
  if (!id || /[\/\\]/.test(id)) {
    return false;
  }

  const storagePath = getStoragePath(basePath);
  const existing = await loadDocuments(storagePath);
  const filtered = existing.filter((d) => d.id !== id);

  if (filtered.length === existing.length) {
    return false; // Not found
  }

  await saveDocumentsArray(storagePath, filtered);

  // Remove associated embeddings
  await removeDocumentEmbeddings(id, storagePath);

  // Try to remove uploaded file (best effort)
  try {
    const uploadPath = path.join(uploadsDir(storagePath), id);
    // Ensure path is within uploads dir (prevent path traversal)
    const resolvedUploads = path.resolve(uploadsDir(storagePath));
    const resolvedUpload = path.resolve(uploadPath);
    if (!resolvedUpload.startsWith(resolvedUploads)) {
      return true; // silently skip file removal
    }
    const entries = await fs.readdir(uploadPath);
    for (const entry of entries) {
      await fs.unlink(path.join(uploadPath, entry));
    }
    await fs.rmdir(uploadPath);
  } catch {
    // File may not exist, that's fine
  }

  return true;
}

/**
 * Update a document's status and optional error message.
 */
export async function updateDocumentStatus(
  id: string,
  status: IndexStatus,
  basePath?: string,
  extras?: Partial<Pick<Document, 'error' | 'indexedAt' | 'chunkCount'>>,
): Promise<void> {
  const storagePath = getStoragePath(basePath);
  const existing = await loadDocuments(storagePath);
  const idx = existing.findIndex((d) => d.id === id);

  if (idx < 0) return;

  existing[idx] = {
    ...existing[idx],
    status,
    ...extras,
  };

  // Clear error when status is not Error
  if (status !== IndexStatus.Error) {
    delete existing[idx].error;
  }

  await saveDocumentsArray(storagePath, existing);
}

// ---------------------------------------------------------------------------
// Raw file storage
// ---------------------------------------------------------------------------

/**
 * Sanitise a user-provided filename to prevent path-traversal.
 * Strips directory components, replaces dangerous characters, and
 * ensures a non-empty result.
 */
function sanitizeFilename(raw: string): string {
  // Take only the basename (strip directory separators)
  const base = path.basename(raw);
  // Remove any remaining path-like characters and null bytes
  const clean = base.replace(/[\x00-\x1f]/g, '').trim();
  return clean || 'upload';
}

/**
 * Save the raw uploaded file to disk.
 */
export async function saveUploadedFile(
  id: string,
  filename: string,
  buffer: Buffer,
  basePath?: string,
): Promise<string> {
  const storagePath = getStoragePath(basePath);
  const dir = path.join(uploadsDir(storagePath), id);
  await fs.mkdir(dir, { recursive: true });
  const safeName = sanitizeFilename(filename);
  const filePath = path.join(dir, safeName);

  // Double-check resolved path is within the uploads directory
  const resolvedDir = path.resolve(dir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedDir)) {
    throw new Error('Invalid filename: path traversal detected');
  }

  await fs.writeFile(filePath, buffer);
  return filePath;
}

// ---------------------------------------------------------------------------
// Document embeddings (JSONL)
// ---------------------------------------------------------------------------

/**
 * Load all document embeddings from the JSONL store.
 */
export async function loadDocumentEmbeddings(
  basePath?: string,
): Promise<DocumentEmbeddingEntry[]> {
  const storagePath = getStoragePath(basePath);
  const filePath = embeddingsFilePath(storagePath);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);
    const entries: DocumentEmbeddingEntry[] = [];
    let skipped = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as DocumentEmbeddingEntry;
        if (
          entry.id &&
          entry.documentId &&
          Array.isArray(entry.embedding) &&
          entry.embedding.length > 0
        ) {
          entries.push(entry);
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }

    if (skipped > 0) {
      console.debug(
        `[DocStore] Loaded ${entries.length} embeddings, skipped ${skipped} invalid`,
      );
    }

    return entries;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('[DocStore] Failed to load embeddings:', err);
    return [];
  }
}

/**
 * Save document embeddings (full overwrite).
 */
async function saveDocumentEmbeddingsArray(
  basePath: string,
  entries: DocumentEmbeddingEntry[],
): Promise<void> {
  await ensureDirs(basePath);
  const filePath = embeddingsFilePath(basePath);
  const content = entries.map((e) => JSON.stringify(e)).join('\n');
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Save embeddings for a set of chunks (upsert pattern: remove old, add new).
 */
export async function saveDocumentEmbeddings(
  documentId: string,
  chunks: DocumentChunk[],
  model: string,
  basePath?: string,
): Promise<void> {
  const storagePath = getStoragePath(basePath);
  const existing = await loadDocumentEmbeddings(storagePath);

  // Remove old entries for this document
  const withoutDoc = existing.filter((e) => e.documentId !== documentId);

  // Create new entries
  const now = new Date().toISOString();
  const newEntries: DocumentEmbeddingEntry[] = chunks
    .filter((c) => c.embedding && c.embedding.length > 0)
    .map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      chunk: chunk.content,
      embedding: chunk.embedding!,
      model,
      createdAt: now,
    }));

  const merged = [...withoutDoc, ...newEntries];
  await saveDocumentEmbeddingsArray(storagePath, merged);

  console.debug(
    `[DocStore] Saved ${newEntries.length} embeddings for doc ${documentId}. Total: ${merged.length}`,
  );
}

/**
 * Remove all embeddings for a specific document.
 */
export async function removeDocumentEmbeddings(
  documentId: string,
  basePath?: string,
): Promise<void> {
  const storagePath = getStoragePath(basePath);
  const existing = await loadDocumentEmbeddings(storagePath);
  const filtered = existing.filter((e) => e.documentId !== documentId);

  if (filtered.length !== existing.length) {
    await saveDocumentEmbeddingsArray(storagePath, filtered);
  }
}

/**
 * Load embeddings for a specific document only.
 */
export async function loadDocumentEmbeddingsById(
  documentId: string,
  basePath?: string,
): Promise<DocumentEmbeddingEntry[]> {
  const all = await loadDocumentEmbeddings(basePath);
  return all.filter((e) => e.documentId === documentId);
}
