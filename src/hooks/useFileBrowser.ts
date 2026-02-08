"use client";

import { useState, useCallback, useEffect } from 'react';
import type { FileEntry, BrowseableRoot, FilePreviewType } from '@/lib/filebrowser/types';

interface FilePreview {
  content: string;
  filename: string;
  type: FilePreviewType;
  language: string;
  size: number;
}

export interface UseFileBrowserReturn {
  roots: BrowseableRoot[];
  currentRoot: BrowseableRoot | null;
  currentPath: string;
  breadcrumbs: { label: string; path: string }[];
  entries: FileEntry[];
  isLoading: boolean;
  error: string | null;

  selectRoot: (rootId: string) => void;
  navigateTo: (relativePath: string) => void;
  navigateUp: () => void;
  navigateToBreadcrumb: (path: string) => void;

  filePreview: FilePreview | null;
  isPreviewLoading: boolean;
  previewFile: (entry: FileEntry) => void;
  closePreview: () => void;

  deleteFile: (entry: FileEntry) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFileBrowser(): UseFileBrowserReturn {
  const [roots, setRoots] = useState<BrowseableRoot[]>([]);
  const [currentRoot, setCurrentRoot] = useState<BrowseableRoot | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Load roots on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/filebrowser');
        const data = await res.json();
        if (data.success) setRoots(data.roots);
      } catch (err) {
        console.error('[FileBrowser] Failed to load roots:', err);
      }
    })();
  }, []);

  const loadDirectory = useCallback(async (rootId: string, path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ rootId, path });
      const res = await fetch(`/api/filebrowser/list?${params}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries);
      } else {
        setError(data.error || 'Fehler beim Laden');
        setEntries([]);
      }
    } catch {
      setError('Verbindungsfehler');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectRoot = useCallback((rootId: string) => {
    const root = roots.find(r => r.id === rootId);
    if (!root) return;
    setCurrentRoot(root);
    setCurrentPath('');
    loadDirectory(rootId, '');
  }, [roots, loadDirectory]);

  const navigateTo = useCallback((relativePath: string) => {
    if (!currentRoot) return;
    setCurrentPath(relativePath);
    loadDirectory(currentRoot.id, relativePath);
  }, [currentRoot, loadDirectory]);

  const navigateUp = useCallback(() => {
    if (!currentRoot) return;
    if (!currentPath) {
      // Go back to root selection
      setCurrentRoot(null);
      setEntries([]);
      setError(null);
      return;
    }
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.join('/');
    setCurrentPath(parentPath);
    loadDirectory(currentRoot.id, parentPath);
  }, [currentRoot, currentPath, loadDirectory]);

  const navigateToBreadcrumb = useCallback((path: string) => {
    if (!currentRoot) return;
    setCurrentPath(path);
    loadDirectory(currentRoot.id, path);
  }, [currentRoot, loadDirectory]);

  const breadcrumbs = (() => {
    if (!currentRoot) return [];
    const crumbs: { label: string; path: string }[] = [
      { label: currentRoot.label, path: '' },
    ];
    if (currentPath) {
      const parts = currentPath.split('/').filter(Boolean);
      let accumulated = '';
      for (const part of parts) {
        accumulated = accumulated ? `${accumulated}/${part}` : part;
        crumbs.push({ label: part, path: accumulated });
      }
    }
    return crumbs;
  })();

  const previewFile = useCallback(async (entry: FileEntry) => {
    if (entry.type === 'directory') return;
    setIsPreviewLoading(true);
    try {
      const params = new URLSearchParams({ rootId: entry.rootId, path: entry.relativePath });
      const res = await fetch(`/api/filebrowser/read?${params}`);
      const data = await res.json();
      if (data.success) {
        setFilePreview({
          content: data.content,
          filename: entry.name,
          type: data.previewType,
          language: data.language,
          size: data.size,
        });
      } else {
        setFilePreview({
          content: data.error || 'Vorschau nicht verfügbar',
          filename: entry.name,
          type: 'text',
          language: 'text',
          size: entry.size,
        });
      }
    } catch {
      setFilePreview({
        content: 'Fehler beim Laden der Vorschau',
        filename: entry.name,
        type: 'text',
        language: 'text',
        size: entry.size,
      });
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setFilePreview(null);
  }, []);

  const deleteFileFn = useCallback(async (entry: FileEntry) => {
    if (entry.rootId !== 'workspace') return;
    try {
      const params = new URLSearchParams({ rootId: entry.rootId, path: entry.relativePath });
      const res = await fetch(`/api/filebrowser/delete?${params}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && currentRoot) {
        await loadDirectory(currentRoot.id, currentPath);
      }
    } catch (err) {
      console.error('[FileBrowser] Delete error:', err);
    }
  }, [currentRoot, currentPath, loadDirectory]);

  const refresh = useCallback(async () => {
    if (currentRoot) {
      await loadDirectory(currentRoot.id, currentPath);
    }
  }, [currentRoot, currentPath, loadDirectory]);

  return {
    roots,
    currentRoot,
    currentPath,
    breadcrumbs,
    entries,
    isLoading,
    error,
    selectRoot,
    navigateTo,
    navigateUp,
    navigateToBreadcrumb,
    filePreview,
    isPreviewLoading,
    previewFile,
    closePreview,
    deleteFile: deleteFileFn,
    refresh,
  };
}
