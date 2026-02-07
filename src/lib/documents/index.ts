// ============================================================================
// Document RAG – Public API
// ============================================================================

export * from './types';
export * from './constants';
export { parseDocument, detectDocumentType } from './parser';
export { chunkDocument } from './chunker';
export type { ChunkOptions } from './chunker';
export {
  getStoragePath,
  loadDocuments,
  saveDocument,
  getDocument,
  deleteDocument,
  updateDocumentStatus,
  saveUploadedFile,
  loadDocumentEmbeddings,
  saveDocumentEmbeddings,
  removeDocumentEmbeddings,
  loadDocumentEmbeddingsById,
} from './store';
export {
  searchDocuments,
  buildRAGContext,
  injectRAGContext,
} from './rag';
