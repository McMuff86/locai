"use client";

import { useState, useCallback, useEffect } from 'react';
import type { FileEntry, BrowseableRoot, FilePreviewType } from '@/lib/filebrowser/types';

interface FilePreview {
  content: string;
  filename: string;
  type: FilePreviewType;
  language: string;
  size: number;
  truncated: boolean;
  rootId: string;
  relativePath: string;
}

export interface UseFileBrowserReturn {
  roots: BrowseableRoot[];
  currentRoot: BrowseableRoot | null;
  currentPath: string;
  breadcrumbs: { label: string; path: string }[];
  entries: FileEntry[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  mutationMessage: string | null;

  selectRoot: (rootId: string) => void;
  navigateTo: (relativePath: string) => void;
  navigateUp: () => void;
  navigateToBreadcrumb: (path: string) => void;

  filePreview: FilePreview | null;
  isPreviewLoading: boolean;
  previewFile: (entry: FileEntry) => void;
  closePreview: () => void;

  createFile: (name: string, content?: string) => Promise<boolean>;
  createFolder: (name: string) => Promise<boolean>;
  renameEntry: (entry: FileEntry, newName: string) => Promise<boolean>;
  moveEntry: (entry: FileEntry, targetPath: string) => Promise<boolean>;
  uploadFiles: (files: File[], targetPath?: string) => Promise<boolean>;
  deleteFile: (entry: FileEntry) => Promise<void>;
  refresh: () => Promise<void>;
  clearMutationMessage: () => void;
}

async function parseJsonResponse(response: Response) {
  const data = await response.json();
  return {
    ok: response.ok,
    data,
  };
}

export function useFileBrowser(): UseFileBrowserReturn {
  const [roots, setRoots] = useState<BrowseableRoot[]>([]);
  const [currentRoot, setCurrentRoot] = useState<BrowseableRoot | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);

  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Load roots on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/filebrowser');
        const { data } = await parseJsonResponse(res);
        if (data.success) {
          setRoots(data.roots);
        }
      } catch (err) {
        console.error('[FileBrowser] Failed to load roots:', err);
      }
    })();
  }, []);

  const loadDirectory = useCallback(async (rootId: string, path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ rootId, path, includeChildCount: 'false' });
      const res = await fetch(`/api/filebrowser/list?${params}`);
      const { data } = await parseJsonResponse(res);
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
    const root = roots.find((r) => r.id === rootId);
    if (!root) return;
    setCurrentRoot(root);
    setCurrentPath('');
    setMutationMessage(null);
    loadDirectory(rootId, '');
  }, [roots, loadDirectory]);

  const navigateTo = useCallback((relativePath: string) => {
    if (!currentRoot) return;
    setCurrentPath(relativePath);
    setMutationMessage(null);
    loadDirectory(currentRoot.id, relativePath);
  }, [currentRoot, loadDirectory]);

  const navigateUp = useCallback(() => {
    if (!currentRoot) return;
    if (!currentPath) {
      setCurrentRoot(null);
      setEntries([]);
      setError(null);
      setMutationMessage(null);
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
    setMutationMessage(null);
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
      const { data } = await parseJsonResponse(res);
      if (data.success) {
        setFilePreview({
          content: data.content,
          filename: entry.name,
          type: data.previewType,
          language: data.language,
          size: data.size,
          truncated: Boolean(data.truncated),
          rootId: entry.rootId,
          relativePath: entry.relativePath,
        });
      } else {
        setFilePreview({
          content: data.error || 'Vorschau nicht verfügbar',
          filename: entry.name,
          type: 'text',
          language: 'text',
          size: entry.size,
          truncated: false,
          rootId: entry.rootId,
          relativePath: entry.relativePath,
        });
      }
    } catch {
      setFilePreview({
        content: 'Fehler beim Laden der Vorschau',
        filename: entry.name,
        type: 'text',
        language: 'text',
        size: entry.size,
        truncated: false,
        rootId: entry.rootId,
        relativePath: entry.relativePath,
      });
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setFilePreview(null);
  }, []);

  const createFileFn = useCallback(async (name: string, content = '') => {
    if (!currentRoot) return false;

    setIsMutating(true);
    setMutationMessage(null);

    try {
      const res = await fetch('/api/filebrowser/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootId: currentRoot.id,
          path: currentPath,
          name,
          type: 'file',
          content,
        }),
      });
      const { data } = await parseJsonResponse(res);

      if (!data.success) {
        setMutationMessage(data.error || 'Datei konnte nicht erstellt werden');
        return false;
      }

      await loadDirectory(currentRoot.id, currentPath);
      setMutationMessage(`Datei erstellt: ${data.entry?.name ?? name}`);
      return true;
    } catch {
      setMutationMessage('Verbindungsfehler beim Erstellen der Datei');
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [currentRoot, currentPath, loadDirectory]);

  const createFolderFn = useCallback(async (name: string) => {
    if (!currentRoot) return false;

    setIsMutating(true);
    setMutationMessage(null);

    try {
      const res = await fetch('/api/filebrowser/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootId: currentRoot.id,
          path: currentPath,
          name,
          type: 'directory',
        }),
      });
      const { data } = await parseJsonResponse(res);

      if (!data.success) {
        setMutationMessage(data.error || 'Ordner konnte nicht erstellt werden');
        return false;
      }

      await loadDirectory(currentRoot.id, currentPath);
      setMutationMessage(`Ordner erstellt: ${data.entry?.name ?? name}`);
      return true;
    } catch {
      setMutationMessage('Verbindungsfehler beim Erstellen des Ordners');
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [currentRoot, currentPath, loadDirectory]);

  const renameEntryFn = useCallback(async (entry: FileEntry, newName: string) => {
    if (!currentRoot) return false;

    setIsMutating(true);
    setMutationMessage(null);

    try {
      const res = await fetch('/api/filebrowser/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootId: entry.rootId,
          path: entry.relativePath,
          newName,
        }),
      });
      const { data } = await parseJsonResponse(res);

      if (!data.success) {
        setMutationMessage(data.error || 'Eintrag konnte nicht umbenannt werden');
        return false;
      }

      await loadDirectory(currentRoot.id, currentPath);
      setMutationMessage(`Umbenannt: ${entry.name} → ${data.entry?.name ?? newName}`);
      return true;
    } catch {
      setMutationMessage('Verbindungsfehler beim Umbenennen');
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [currentRoot, currentPath, loadDirectory]);

  const moveEntryFn = useCallback(async (entry: FileEntry, targetPath: string) => {
    if (!currentRoot) return false;

    setIsMutating(true);
    setMutationMessage(null);

    try {
      const res = await fetch('/api/filebrowser/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootId: entry.rootId,
          path: entry.relativePath,
          targetPath,
        }),
      });
      const { data } = await parseJsonResponse(res);

      if (!data.success) {
        setMutationMessage(data.error || 'Eintrag konnte nicht verschoben werden');
        return false;
      }

      await loadDirectory(currentRoot.id, currentPath);
      setMutationMessage(`Verschoben: ${entry.name}`);
      return true;
    } catch {
      setMutationMessage('Verbindungsfehler beim Verschieben');
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [currentRoot, currentPath, loadDirectory]);

  const uploadFilesFn = useCallback(async (files: File[], targetPath?: string) => {
    if (!currentRoot || files.length === 0) return false;

    setIsMutating(true);
    setMutationMessage(null);

    try {
      const formData = new FormData();
      formData.append('rootId', currentRoot.id);
      formData.append('path', targetPath ?? currentPath);
      for (const file of files) {
        formData.append('files', file);
      }

      const res = await fetch('/api/filebrowser/upload', {
        method: 'POST',
        body: formData,
      });
      const { data } = await parseJsonResponse(res);

      if (!data.success && (!Array.isArray(data.uploaded) || data.uploaded.length === 0)) {
        setMutationMessage(data.error || 'Upload fehlgeschlagen');
        return false;
      }

      await loadDirectory(currentRoot.id, currentPath);

      const uploadedCount = Array.isArray(data.uploaded) ? data.uploaded.length : 0;
      const rejectedCount = Array.isArray(data.rejected) ? data.rejected.length : 0;
      if (rejectedCount > 0) {
        setMutationMessage(`${uploadedCount} Datei(en) hochgeladen, ${rejectedCount} abgelehnt`);
      } else {
        setMutationMessage(`${uploadedCount} Datei(en) hochgeladen`);
      }
      return uploadedCount > 0;
    } catch {
      setMutationMessage('Verbindungsfehler beim Upload');
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [currentRoot, currentPath, loadDirectory]);

  const deleteFileFn = useCallback(async (entry: FileEntry) => {
    if (entry.rootId !== 'workspace') return;
    try {
      const params = new URLSearchParams({ rootId: entry.rootId, path: entry.relativePath });
      const res = await fetch(`/api/filebrowser/delete?${params}`, { method: 'DELETE' });
      const { data } = await parseJsonResponse(res);
      if (data.success && currentRoot) {
        await loadDirectory(currentRoot.id, currentPath);
        setMutationMessage(`Gelöscht: ${entry.name}`);
      } else if (!data.success) {
        setMutationMessage(data.error || 'Löschen fehlgeschlagen');
      }
    } catch (err) {
      console.error('[FileBrowser] Delete error:', err);
      setMutationMessage('Verbindungsfehler beim Löschen');
    }
  }, [currentRoot, currentPath, loadDirectory]);

  const refresh = useCallback(async () => {
    if (currentRoot) {
      await loadDirectory(currentRoot.id, currentPath);
    }
  }, [currentRoot, currentPath, loadDirectory]);

  const clearMutationMessage = useCallback(() => {
    setMutationMessage(null);
  }, []);

  return {
    roots,
    currentRoot,
    currentPath,
    breadcrumbs,
    entries,
    isLoading,
    isMutating,
    error,
    mutationMessage,
    selectRoot,
    navigateTo,
    navigateUp,
    navigateToBreadcrumb,
    filePreview,
    isPreviewLoading,
    previewFile,
    closePreview,
    createFile: createFileFn,
    createFolder: createFolderFn,
    renameEntry: renameEntryFn,
    moveEntry: moveEntryFn,
    uploadFiles: uploadFilesFn,
    deleteFile: deleteFileFn,
    refresh,
    clearMutationMessage,
  };
}
