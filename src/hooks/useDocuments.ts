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
  /** Rename a document */
  renameDocument: (id: string, newName: string) => Promise<void>;
  /** Copy (duplicate) a document */
  copyDocument: (id: string) => Promise<void>;
  /** Semantic search across documents */
  searchDocuments: (query: string) => Promise<DocumentSearchResult[]>;
  /** Number of ready (indexed) documents */
  readyCount: number;
  /** Refresh document list */
  refresh: () => Promise<void>;
}

interface UseDocumentsOptions {
  /** Polling interval for status refreshes. Set to 0 to disable polling. */
  pollIntervalMs?: number;
  /** Automatically fetch documents on mount. */
  autoFetch?: boolean;
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
export function useDocuments(options: UseDocumentsOptions = {}): UseDocumentsReturn {
  const { pollIntervalMs = 5000, autoFetch = true } = options;
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
    if (!autoFetch) {
      setIsLoading(false);
      return;
    }

    fetchDocuments();

    if (pollIntervalMs > 0) {
      pollingRef.current = setInterval(fetchDocuments, pollIntervalMs);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [autoFetch, fetchDocuments, pollIntervalMs]);

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

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Upload fehlgeschlagen' }));
        throw new Error(error.error || 'Upload fehlgeschlagen');
      }

      const data = await res.json();
      if (data.document) {
        setDocuments((prev) => [data.document, ...prev]);
      }

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

  // ── Rename ─────────────────────────────────────────────────────────────
  const renameDocument = useCallback(async (id: string, newName: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Umbenennen fehlgeschlagen' }));
        throw new Error(error.error || 'Umbenennen fehlgeschlagen');
      }

      const data = await res.json();
      setDocuments((prev) => prev.map((d) => (d.id === id ? data.document : d)));
      toast({ title: 'Dokument umbenannt', description: `Neuer Name: "${newName}"` });
    } catch (err) {
      console.error('[useDocuments] rename error', err);
      toast({
        title: 'Umbenennen fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
    }
  }, []);

  // ── Copy ──────────────────────────────────────────────────────────────
  const copyDocument = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}/copy`, { method: 'POST' });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Kopieren fehlgeschlagen' }));
        throw new Error(error.error || 'Kopieren fehlgeschlagen');
      }

      const data = await res.json();
      if (data.document) {
        setDocuments((prev) => [data.document, ...prev]);
      }
      toast({
        title: 'Dokument kopiert',
        description: `"${data.document?.name}" wurde erstellt.`,
      });
    } catch (err) {
      console.error('[useDocuments] copy error', err);
      toast({
        title: 'Kopieren fehlgeschlagen',
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
    renameDocument,
    copyDocument,
    searchDocuments,
    readyCount,
    refresh: fetchDocuments,
  };
}
