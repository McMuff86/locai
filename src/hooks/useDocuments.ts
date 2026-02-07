"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import type {
  Document,
  DocumentSearchResult,
} from '@/lib/documents/types';
import { MAX_FILE_SIZE } from '@/lib/documents/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseDocumentsReturn {
  /** All documents in the store */
  documents: Document[];
  /** Currently uploading */
  isUploading: boolean;
  /** Initial load in progress */
  isLoading: boolean;
  /** RAG toggle state */
  ragEnabled: boolean;
  /** Toggle RAG on/off */
  toggleRag: () => void;
  /** Set RAG state explicitly */
  setRagEnabled: (enabled: boolean) => void;
  /** Upload a single file */
  uploadDocument: (file: File) => Promise<void>;
  /** Delete a document by id */
  deleteDocument: (id: string) => Promise<void>;
  /** Semantic search across documents */
  searchDocuments: (query: string) => Promise<DocumentSearchResult[]>;
  /** Number of ready (indexed) documents */
  readyCount: number;
  /** Refresh document list */
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for managing the document RAG lifecycle.
 *
 * Provides:
 * - Document CRUD (list, upload, delete)
 * - Semantic search over indexed documents
 * - RAG toggle state for the chat
 * - Auto-polling (every 5s) to pick up indexing status changes
 *
 * @returns {UseDocumentsReturn} Document state and actions
 */
export function useDocuments(): UseDocumentsReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ragEnabled, setRagEnabled] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch documents ────────────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Fehler beim Laden der Dokumente');
      const data = await res.json();
      setDocuments(data.documents ?? data ?? []);
    } catch (err) {
      console.error('[useDocuments] fetch error', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Initial load + polling ─────────────────────────────────────────────
  useEffect(() => {
    fetchDocuments();

    // Poll every 5s to pick up indexing progress
    pollingRef.current = setInterval(fetchDocuments, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchDocuments]);

  // ── Upload ─────────────────────────────────────────────────────────────
  const uploadDocument = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Datei zu gross',
        description: `Maximale Dateigrösse: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Upload fehlgeschlagen' }));
        throw new Error(error.error || 'Upload fehlgeschlagen');
      }

      const newDoc = await res.json();
      setDocuments((prev) => [newDoc, ...prev]);

      toast({
        title: 'Dokument hochgeladen',
        description: `"${file.name}" wird jetzt indexiert…`,
      });

      // Refresh after short delay to get indexing status
      setTimeout(fetchDocuments, 1500);
    } catch (err) {
      console.error('[useDocuments] upload error', err);
      toast({
        title: 'Upload fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [fetchDocuments]);

  // ── Delete ─────────────────────────────────────────────────────────────
  const deleteDocument = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Löschen fehlgeschlagen' }));
        throw new Error(error.error || 'Löschen fehlgeschlagen');
      }

      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast({
        title: 'Dokument gelöscht',
        description: 'Das Dokument und seine Embeddings wurden entfernt.',
      });
    } catch (err) {
      console.error('[useDocuments] delete error', err);
      toast({
        title: 'Löschen fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
    }
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────
  const searchDocuments = useCallback(async (query: string): Promise<DocumentSearchResult[]> => {
    try {
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) throw new Error('Suche fehlgeschlagen');
      const data = await res.json();
      return data.results ?? [];
    } catch (err) {
      console.error('[useDocuments] search error', err);
      return [];
    }
  }, []);

  // ── Toggle ─────────────────────────────────────────────────────────────
  const toggleRag = useCallback(() => {
    setRagEnabled((prev) => !prev);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────
  const readyCount = documents.filter((d) => d.status === 'ready').length;

  return {
    documents,
    isUploading,
    isLoading,
    ragEnabled,
    toggleRag,
    setRagEnabled,
    uploadDocument,
    deleteDocument,
    searchDocuments,
    readyCount,
    refresh: fetchDocuments,
  };
}
