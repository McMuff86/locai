// ============================================================================
// POST /api/documents/upload
// ============================================================================
// Handles file upload, parsing, chunking, and embedding in one request.
// Supports multipart/form-data with a single 'file' field.
// ============================================================================

import { NextRequest } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import {
  Document,
  IndexStatus,
  UploadOptions,
} from '@/lib/documents/types';
import {
  MAX_FILE_SIZE,
  MAX_DOCUMENTS,
  DEFAULT_EMBEDDING_MODEL,
  MAX_EMBED_TEXT_LENGTH,
} from '@/lib/documents/constants';
import { parseDocument, detectDocumentType } from '@/lib/documents/parser';
import { chunkDocument } from '@/lib/documents/chunker';
import {
  saveDocument,
  saveUploadedFile,
  saveDocumentEmbeddings,
  updateDocumentStatus,
  loadDocuments,
} from '@/lib/documents/store';
import { embedQuery } from '@/lib/notes/embeddings';
import { resolveAndValidateOllamaHost } from '../../_utils/ollama';
import { apiError, apiSuccess } from '../../_utils/responses';

export const runtime = 'nodejs';

function generateId(): string {
  return randomBytes(12).toString('base64url');
}

function contentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return apiError('Keine Datei hochgeladen', 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiError(
        `Datei zu gross (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${MAX_FILE_SIZE / 1024 / 1024} MB`,
        400,
      );
    }

    // Read options from form data
    const options: UploadOptions = {
      model:
        (formData.get('model') as string) || DEFAULT_EMBEDDING_MODEL,
      host:
        (formData.get('host') as string) || undefined,
      chunkSize: formData.get('chunkSize')
        ? parseInt(formData.get('chunkSize') as string, 10)
        : undefined,
      chunkOverlap: formData.get('chunkOverlap')
        ? parseInt(formData.get('chunkOverlap') as string, 10)
        : undefined,
    };

    let host: string;
    try {
      host = resolveAndValidateOllamaHost(options.host);
    } catch (err) {
      return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
    }
    const model = options.model || DEFAULT_EMBEDDING_MODEL;

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = file.name;
    const mimeType = file.type || 'application/octet-stream';

    // Detect type
    const docType = detectDocumentType(filename, mimeType);

    // Generate ID and content hash
    const id = generateId();
    const hash = contentHash(buffer);

    // Check document limit and duplicate
    const existingDocs = await loadDocuments();

    if (existingDocs.length >= MAX_DOCUMENTS) {
      return apiError(
        `Maximale Anzahl Dokumente erreicht (${MAX_DOCUMENTS}). Bitte lösche zuerst alte Dokumente.`,
        400,
      );
    }

    const duplicate = existingDocs.find((d) => d.contentHash === hash);
    if (duplicate) {
      return apiError(
        `Dieses Dokument wurde bereits hochgeladen als "${duplicate.name}"`,
        409,
        { existingId: duplicate.id },
      );
    }

    // Create initial document record
    const doc: Document = {
      id,
      name: filename,
      type: docType,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      indexedAt: null,
      chunkCount: 0,
      status: IndexStatus.Pending,
      contentHash: hash,
    };

    // Save metadata + raw file
    await saveDocument(doc);
    await saveUploadedFile(id, filename, buffer);

    // Update status to indexing
    await updateDocumentStatus(id, IndexStatus.Indexing);

    try {
      // 1. Parse
      const text = await parseDocument(buffer, filename, mimeType);

      // 2. Chunk
      const chunks = chunkDocument(text, id, docType, {
        chunkSize: options.chunkSize,
        chunkOverlap: options.chunkOverlap,
      });

      if (chunks.length === 0) {
        throw new Error(
          'Dokument konnte nicht in Abschnitte aufgeteilt werden',
        );
      }

      // 3. Embed each chunk
      for (let i = 0; i < chunks.length; i++) {
        const truncated = chunks[i].content.slice(0, MAX_EMBED_TEXT_LENGTH);
        const embedding = await embedQuery(truncated, { host, model });
        chunks[i].embedding = embedding;
        chunks[i].model = model;
      }

      // 4. Save embeddings
      await saveDocumentEmbeddings(id, chunks, model);

      // 5. Update status to ready
      await updateDocumentStatus(id, IndexStatus.Ready, undefined, {
        indexedAt: new Date().toISOString(),
        chunkCount: chunks.length,
      });

      return apiSuccess({
        document: {
          ...doc,
          status: IndexStatus.Ready,
          chunkCount: chunks.length,
          indexedAt: new Date().toISOString(),
        },
      });
    } catch (indexErr) {
      const errorMsg =
        indexErr instanceof Error
          ? indexErr.message
          : 'Indexierung fehlgeschlagen';

      await updateDocumentStatus(id, IndexStatus.Error, undefined, {
        error: errorMsg,
      });

      return apiError(
        `Datei hochgeladen, aber Indexierung fehlgeschlagen: ${errorMsg}`,
        500,
        {
          document: {
            ...doc,
            status: IndexStatus.Error,
            error: errorMsg,
          },
        },
      );
    }
  } catch (err) {
    console.error('[Upload] Error:', err);
    return apiError(
      err instanceof Error ? err.message : 'Upload fehlgeschlagen',
      500,
    );
  }
}
