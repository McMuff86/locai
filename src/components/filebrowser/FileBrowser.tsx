"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Hammer,
  Database,
  FileText,
  RefreshCw,
  Loader2,
  ChevronLeft,
  FolderOpen,
  ChevronRight,
  Search,
  ArrowUpDown,
  FilePlus2,
  FolderPlus,
  Upload,
  FolderInput,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFileBrowser } from '@/hooks/useFileBrowser';
import { FileEntryRow } from './FileEntryRow';
import { FilePreviewDialog } from './FilePreviewDialog';
import type { FileEntry } from '@/lib/filebrowser/types';

interface FileBrowserProps {
  /**
   * When provided, clicking a file opens it on the canvas instead of
   * the built-in FilePreviewDialog. The dialog is still used as fallback
   * when this prop is absent.
   */
  onOpenFile?: (entry: FileEntry) => void;
}

const ROOT_ICONS: Record<string, React.ReactNode> = {
  workspace: <Hammer className="h-5 w-5" />,
  locai: <Database className="h-5 w-5" />,
  documents: <FileText className="h-5 w-5" />,
};

const ROOT_DESCRIPTIONS: Record<string, string> = {
  workspace: 'Vom Agent erstellte Dateien',
  locai: 'Konfiguration & Daten',
  documents: 'Persönliche Dokumente',
};

type SortBy = 'name' | 'modifiedAt' | 'size';
type SortOrder = 'asc' | 'desc';
type TypeFilter = 'all' | 'file' | 'directory' | 'code' | 'markdown' | 'json' | 'text';
type CreateDialogMode = 'file' | 'directory';

const OPEN_FILE_IN_AGENT_SESSION_KEY = 'openFileInAgent';
const AGENT_PREVIEW_SNIPPET_LIMIT = 4000;

function normalizeRelativePath(pathValue: string): string {
  const withForwardSlashes = pathValue.trim().replace(/\\/g, '/');
  if (!withForwardSlashes) return '';

  const segments = withForwardSlashes
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');

  return segments.join('/');
}

function validateEntryName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name darf nicht leer sein.';
  if (trimmed === '.' || trimmed === '..') return 'Ungültiger Name.';
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return 'Name darf keine Pfadseparatoren enthalten.';
  }
  return null;
}

function validateTargetDirectoryPath(pathValue: string): string | null {
  const normalized = pathValue.trim().replace(/\\/g, '/');
  if (!normalized) return null;
  if (normalized.includes('\0')) return 'Pfad enthält ungültige Zeichen.';
  if (normalized.includes('..')) return 'Pfad darf kein ".." enthalten.';
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return 'Bitte einen relativen Pfad zum Workspace verwenden.';
  }
  return null;
}

function classifyEntry(entry: FileEntry): TypeFilter {
  if (entry.type === 'directory') return 'directory';
  if (entry.extension === '.md') return 'markdown';
  if (entry.extension === '.json') return 'json';
  if (['.txt', '.log', '.csv'].includes(entry.extension)) return 'text';
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.sh', '.css', '.html'].includes(entry.extension)) {
    return 'code';
  }
  return 'file';
}

export function FileBrowser({ onOpenFile }: FileBrowserProps = {}) {
  const router = useRouter();
  const {
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
    createFile,
    createFolder,
    renameEntry,
    moveEntry,
    uploadFiles,
    deleteFile,
    refresh,
    clearMutationMessage,
  } = useFileBrowser();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [draggedEntry, setDraggedEntry] = useState<FileEntry | null>(null);
  const [isDropZoneActive, setIsDropZoneActive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogMode, setCreateDialogMode] = useState<CreateDialogMode>('file');
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameEntryTarget, setRenameEntryTarget] = useState<FileEntry | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [moveEntryTarget, setMoveEntryTarget] = useState<FileEntry | null>(null);
  const [moveTargetPath, setMoveTargetPath] = useState('');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movePickerPath, setMovePickerPath] = useState('');
  const [movePickerDirectories, setMovePickerDirectories] = useState<FileEntry[]>([]);
  const [isMovePickerLoading, setIsMovePickerLoading] = useState(false);
  const [movePickerError, setMovePickerError] = useState<string | null>(null);

  const canMutate = currentRoot?.id === 'workspace';

  // Route file open to canvas callback when available, otherwise use the built-in dialog
  const handlePreviewOrOpen = useCallback((entry: FileEntry) => {
    if (onOpenFile && entry.type === 'file') {
      onOpenFile(entry);
    } else {
      previewFile(entry);
    }
  }, [onOpenFile, previewFile]);

  const extensionOptions = useMemo(() => {
    const values = new Set(
      entries
        .filter((entry) => entry.type === 'file' && entry.extension)
        .map((entry) => entry.extension),
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  useEffect(() => {
    if (extensionFilter !== 'all' && !extensionOptions.includes(extensionFilter)) {
      setExtensionFilter('all');
    }
  }, [extensionFilter, extensionOptions]);

  const visibleEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = entries.filter((entry) => {
      if (normalizedQuery && !entry.name.toLowerCase().includes(normalizedQuery)) {
        return false;
      }

      if (typeFilter !== 'all') {
        const entryType = classifyEntry(entry);
        if (typeFilter === 'file') {
          if (entry.type !== 'file') return false;
        } else if (entryType !== typeFilter) {
          return false;
        }
      }

      if (extensionFilter !== 'all' && entry.type === 'file' && entry.extension !== extensionFilter) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'name') {
        if (a.type !== b.type) {
          comparison = a.type === 'directory' ? -1 : 1;
        } else {
          comparison = a.name.localeCompare(b.name, 'de');
        }
      }

      if (sortBy === 'modifiedAt') {
        comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      }

      if (sortBy === 'size') {
        comparison = a.size - b.size;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [entries, searchQuery, typeFilter, extensionFilter, sortBy, sortOrder]);

  const loadMovePickerDirectories = useCallback(async (pathValue: string) => {
    if (!currentRoot) return;

    const normalizedPath = normalizeRelativePath(pathValue);
    setIsMovePickerLoading(true);
    setMovePickerError(null);

    try {
      const params = new URLSearchParams({
        rootId: currentRoot.id,
        path: normalizedPath,
        includeChildCount: 'false',
      });

      const res = await fetch(`/api/filebrowser/list?${params}`);
      const payload = (await res.json()) as {
        success?: boolean;
        entries?: FileEntry[];
        error?: string;
      };

      if (!res.ok || !payload.success) {
        setMovePickerDirectories([]);
        setMovePickerError(payload.error || 'Ordner konnten nicht geladen werden.');
        return;
      }

      const directories = Array.isArray(payload.entries)
        ? payload.entries.filter((entry) => entry.type === 'directory')
        : [];

      setMovePickerDirectories(directories);
      setMovePickerPath(normalizedPath);
    } catch {
      setMovePickerDirectories([]);
      setMovePickerError('Ordner konnten nicht geladen werden.');
    } finally {
      setIsMovePickerLoading(false);
    }
  }, [currentRoot]);

  const handleOpenInAgent = useCallback(async (entry: FileEntry) => {
    if (entry.type !== 'file' || !currentRoot) return;

    try {
      // Fetch a preview snippet of the file content
      const params = new URLSearchParams({ rootId: currentRoot.id, path: entry.relativePath });
      const res = await fetch(`/api/filebrowser/read?${params}`);
      const payload = await res.json() as { content?: string; truncated?: boolean; error?: string };

      const snippet = (payload.content ?? '').slice(0, AGENT_PREVIEW_SNIPPET_LIMIT);
      const truncated = !!(payload.truncated || (payload.content ?? '').length > AGENT_PREVIEW_SNIPPET_LIMIT);

      sessionStorage.setItem(
        OPEN_FILE_IN_AGENT_SESSION_KEY,
        JSON.stringify({
          rootId: currentRoot.id,
          relativePath: entry.relativePath,
          filename: entry.name,
          previewSnippet: snippet,
          previewTruncated: truncated,
        }),
      );
      router.push('/chat?openFileInAgent=true');
    } catch (err) {
      console.error('Open in agent failed:', err);
    }
  }, [currentRoot, router]);

  const handleCreateFile = () => {
    if (!canMutate) return;
    clearMutationMessage();
    setCreateDialogMode('file');
    setCreateName('neue-datei.txt');
    setCreateError(null);
    setIsCreateDialogOpen(true);
  };

  const handleCreateFolder = () => {
    if (!canMutate) return;
    clearMutationMessage();
    setCreateDialogMode('directory');
    setCreateName('neuer-ordner');
    setCreateError(null);
    setIsCreateDialogOpen(true);
  };

  const handleRename = (entry: FileEntry) => {
    if (!canMutate) return;
    clearMutationMessage();
    setRenameEntryTarget(entry);
    setRenameName(entry.name);
    setRenameError(null);
    setIsRenameDialogOpen(true);
  };

  const handleMove = async (entry: FileEntry) => {
    if (!canMutate) return;
    clearMutationMessage();
    const initialTargetPath = normalizeRelativePath(currentPath);

    setMoveEntryTarget(entry);
    setMoveTargetPath(initialTargetPath);
    setMoveError(null);
    setMovePickerPath(initialTargetPath);
    setMovePickerDirectories([]);
    setMovePickerError(null);
    setIsMoveDialogOpen(true);

    await loadMovePickerDirectories(initialTargetPath);
  };

  const handleCreateDialogSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate) return;

    const validationError = validateEntryName(createName);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    const safeName = createName.trim();
    const success = createDialogMode === 'file'
      ? await createFile(safeName)
      : await createFolder(safeName);

    if (success) {
      setIsCreateDialogOpen(false);
      setCreateName('');
      setCreateError(null);
      return;
    }

    setCreateError('Aktion fehlgeschlagen. Prüfe die Statusmeldung.');
  };

  const handleRenameDialogSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !renameEntryTarget) return;

    const validationError = validateEntryName(renameName);
    if (validationError) {
      setRenameError(validationError);
      return;
    }

    const safeName = renameName.trim();
    if (safeName === renameEntryTarget.name) {
      setRenameError('Bitte einen anderen Namen eingeben.');
      return;
    }

    const success = await renameEntry(renameEntryTarget, safeName);
    if (success) {
      setIsRenameDialogOpen(false);
      setRenameEntryTarget(null);
      setRenameName('');
      setRenameError(null);
      return;
    }

    setRenameError('Umbenennen fehlgeschlagen. Prüfe die Statusmeldung.');
  };

  const handleMoveDialogSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !moveEntryTarget) return;

    const validationError = validateTargetDirectoryPath(moveTargetPath);
    if (validationError) {
      setMoveError(validationError);
      return;
    }

    const normalizedTargetPath = normalizeRelativePath(moveTargetPath);
    const success = await moveEntry(moveEntryTarget, normalizedTargetPath);
    if (success) {
      setIsMoveDialogOpen(false);
      setMoveEntryTarget(null);
      setMoveTargetPath('');
      setMoveError(null);
      setMovePickerDirectories([]);
      return;
    }

    setMoveError('Verschieben fehlgeschlagen. Prüfe die Statusmeldung.');
  };

  const handleMovePickerNavigateUp = () => {
    const parts = movePickerPath.split('/').filter(Boolean);
    parts.pop();
    void loadMovePickerDirectories(parts.join('/'));
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    await uploadFiles(files, currentPath);
    e.target.value = '';
  };

  const handleDragOverDropZone = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (canMutate) {
      setIsDropZoneActive(true);
    }
  };

  const handleDragLeaveDropZone = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropZoneActive(false);
  };

  const handleDropOnCurrentDirectory = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropZoneActive(false);

    if (!canMutate) {
      setDraggedEntry(null);
      return;
    }

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await uploadFiles(files, currentPath);
      setDraggedEntry(null);
      return;
    }

    if (draggedEntry) {
      await moveEntry(draggedEntry, currentPath);
      setDraggedEntry(null);
    }
  };

  const handleDropOnDirectory = async (targetDirectoryPath: string) => {
    if (!canMutate || !draggedEntry) return;
    if (draggedEntry.relativePath === targetDirectoryPath) return;
    await moveEntry(draggedEntry, targetDirectoryPath);
    setDraggedEntry(null);
  };

  const handleDropFilesOnDirectory = async (targetDirectoryPath: string, files: File[]) => {
    if (!canMutate || files.length === 0) return;
    await uploadFiles(files, targetDirectoryPath);
    setDraggedEntry(null);
  };

  const renderRootSelector = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {roots.map((root) => (
        <button
          key={root.id}
          onClick={() => root.exists && selectRoot(root.id)}
          disabled={!root.exists}
          className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-center"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
            {ROOT_ICONS[root.id] || <FileText className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-medium">{root.label}</p>
            <p className="text-xs text-muted-foreground">
              {root.exists
                ? ROOT_DESCRIPTIONS[root.id]
                : 'Nicht vorhanden'}
            </p>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {currentRoot && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={navigateUp}
              title="Zurück"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {currentRoot ? currentRoot.label : 'Dateibrowser'}
            </h2>
            {!currentRoot && (
              <p className="text-xs text-muted-foreground">
                Wähle einen Ordner zum Durchsuchen
              </p>
            )}
          </div>
        </div>
        {currentRoot && (
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={isLoading}
            title="Aktualisieren"
            className="h-8 w-8"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {!currentRoot && renderRootSelector()}

      {currentRoot && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-sm flex-shrink-0 flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
              <button
                onClick={() => {
                  clearMutationMessage();
                  navigateToBreadcrumb(crumb.path);
                }}
                className={`px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors truncate max-w-[160px] ${
                  i === breadcrumbs.length - 1
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {currentRoot && (
        <div className="space-y-2 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suche nach Dateiname..."
                className="pl-8 h-9"
              />
            </div>

            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                title="Sortierung"
              >
                <option value="name">Name</option>
                <option value="modifiedAt">Datum</option>
                <option value="size">Größe</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title="Sortierreihenfolge wechseln"
              >
                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              title="Dateityp filtern"
            >
              <option value="all">Alle Typen</option>
              <option value="file">Dateien</option>
              <option value="directory">Ordner</option>
              <option value="code">Code</option>
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
              <option value="text">Text</option>
            </select>

            <select
              value={extensionFilter}
              onChange={(e) => setExtensionFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              title="Extension filtern"
            >
              <option value="all">Alle Endungen</option>
              {extensionOptions.map((extension) => (
                <option key={extension} value={extension}>{extension}</option>
              ))}
            </select>

            <div className="ml-auto text-xs text-muted-foreground">
              {visibleEntries.length} / {entries.length} Einträge
            </div>
          </div>

          {canMutate ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCreateFile} disabled={isMutating}>
                <FilePlus2 className="h-3.5 w-3.5 mr-1.5" />
                Neu
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateFolder} disabled={isMutating}>
                <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                Ordner erstellen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isMutating}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Dateien hochladen
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              <span className="text-xs text-muted-foreground ml-1">
                Drag & Drop: Dateien hierher ziehen oder Einträge auf Ordner fallen lassen.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-2 py-1">
              <FolderInput className="h-3.5 w-3.5" />
              Dieser Bereich ist schreibgeschützt. Änderungen sind nur im Workspace möglich.
            </div>
          )}
        </div>
      )}

      {mutationMessage && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          {mutationMessage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {currentRoot && (
        <div
          className={`flex-1 min-h-0 rounded-lg border transition-colors ${
            isDropZoneActive ? 'border-primary bg-primary/5' : 'border-border/60'
          }`}
          onDragOver={handleDragOverDropZone}
          onDragLeave={handleDragLeaveDropZone}
          onDrop={handleDropOnCurrentDirectory}
        >
          {isLoading && entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Laden…</p>
            </div>
          ) : visibleEntries.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="rounded-full p-4 bg-muted/50">
                <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Noch keine passenden Dateien
                </p>
                <p className="text-xs text-muted-foreground">
                  Passe Filter an oder lege neue Dateien an.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-0.5 pr-2 p-2">
                {visibleEntries.map((entry) => (
                  <FileEntryRow
                    key={entry.relativePath}
                    entry={entry}
                    canMutate={canMutate}
                    onNavigate={navigateTo}
                    onPreview={handlePreviewOrOpen}
                    onDelete={deleteFile}
                    onRename={handleRename}
                    onMove={handleMove}
                    onOpenInAgent={handleOpenInAgent}
                    onDragStart={setDraggedEntry}
                    onDragEnd={() => setDraggedEntry(null)}
                    onDropOnDirectory={handleDropOnDirectory}
                    onDropFilesOnDirectory={handleDropFilesOnDirectory}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      <FilePreviewDialog
        open={filePreview !== null}
        onOpenChange={(open) => { if (!open) closePreview(); }}
        preview={filePreview}
        isLoading={isPreviewLoading}
        rootId={filePreview?.rootId}
        relativePath={filePreview?.relativePath}
        onSaved={refresh}
      />

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setCreateError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createDialogMode === 'file' ? 'Neue Datei erstellen' : 'Neuen Ordner erstellen'}
            </DialogTitle>
            <DialogDescription>
              {createDialogMode === 'file'
                ? 'Dateiname im aktuellen Workspace-Ordner angeben.'
                : 'Ordnername im aktuellen Workspace-Ordner angeben.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateDialogSubmit}>
            <div className="space-y-2">
              <label htmlFor="filebrowser-create-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="filebrowser-create-name"
                value={createName}
                onChange={(event) => {
                  setCreateName(event.target.value);
                  if (createError) {
                    setCreateError(null);
                  }
                }}
                autoFocus
                disabled={isMutating}
              />
              {createError && (
                <p className="text-xs text-destructive">
                  {createError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isMutating}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {createDialogMode === 'file' ? 'Datei erstellen' : 'Ordner erstellen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRenameDialogOpen}
        onOpenChange={(open) => {
          setIsRenameDialogOpen(open);
          if (!open) {
            setRenameError(null);
            setRenameEntryTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eintrag umbenennen</DialogTitle>
            <DialogDescription>
              {renameEntryTarget
                ? `Neuer Name für "${renameEntryTarget.name}".`
                : 'Neuen Namen eingeben.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleRenameDialogSubmit}>
            <div className="space-y-2">
              <label htmlFor="filebrowser-rename-name" className="text-sm font-medium">
                Neuer Name
              </label>
              <Input
                id="filebrowser-rename-name"
                value={renameName}
                onChange={(event) => {
                  setRenameName(event.target.value);
                  if (renameError) {
                    setRenameError(null);
                  }
                }}
                autoFocus
                disabled={isMutating}
              />
              {renameError && (
                <p className="text-xs text-destructive">
                  {renameError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenameDialogOpen(false)}
                disabled={isMutating}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isMutating || !renameEntryTarget}>
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Umbenennen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isMoveDialogOpen}
        onOpenChange={(open) => {
          setIsMoveDialogOpen(open);
          if (!open) {
            setMoveError(null);
            setMovePickerError(null);
            setMoveEntryTarget(null);
            setMovePickerDirectories([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Eintrag verschieben</DialogTitle>
            <DialogDescription>
              {moveEntryTarget
                ? `Zielordner für "${moveEntryTarget.name}" auswählen.`
                : 'Zielordner auswählen.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleMoveDialogSubmit}>
            <div className="space-y-2">
              <label htmlFor="filebrowser-move-target" className="text-sm font-medium">
                Zielordner (relativ zum Workspace)
              </label>
              <Input
                id="filebrowser-move-target"
                value={moveTargetPath}
                onChange={(event) => {
                  setMoveTargetPath(event.target.value);
                  if (moveError) {
                    setMoveError(null);
                  }
                }}
                placeholder="leer = Workspace root"
                autoFocus
                disabled={isMutating}
              />
              <p className="text-xs text-muted-foreground">
                Leer lassen, um in den Workspace-Root zu verschieben.
              </p>
              {moveError && (
                <p className="text-xs text-destructive">
                  {moveError}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
                <p className="text-xs text-muted-foreground truncate">
                  Picker-Pfad: {movePickerPath || 'Workspace root'}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleMovePickerNavigateUp}
                    disabled={isMovePickerLoading || !movePickerPath}
                    title="Eine Ebene hoch"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setMoveTargetPath(movePickerPath);
                      setMoveError(null);
                    }}
                    disabled={isMutating}
                    title="Aktuellen Picker-Pfad als Ziel setzen"
                  >
                    Als Ziel
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-48">
                <div className="p-2 space-y-1">
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded-md text-sm border transition-colors ${
                      normalizeRelativePath(moveTargetPath) === ''
                        ? 'border-primary/40 bg-primary/10'
                        : 'border-transparent hover:bg-muted/60'
                    }`}
                    onClick={() => setMoveTargetPath('')}
                    disabled={isMutating}
                  >
                    Workspace root
                  </button>

                  {isMovePickerLoading ? (
                    <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Ordner werden geladen…
                    </div>
                  ) : movePickerError ? (
                    <div className="px-2 py-2 text-xs text-destructive">
                      {movePickerError}
                    </div>
                  ) : movePickerDirectories.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      Keine Unterordner vorhanden.
                    </div>
                  ) : (
                    movePickerDirectories.map((directory) => {
                      const isSelected = normalizeRelativePath(moveTargetPath) === directory.relativePath;
                      return (
                        <div key={directory.relativePath} className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            className={`h-8 flex-1 justify-start px-2 ${
                              isSelected ? 'bg-primary/10 text-primary' : ''
                            }`}
                            onClick={() => {
                              setMoveTargetPath(directory.relativePath);
                              setMoveError(null);
                            }}
                            disabled={isMutating}
                          >
                            <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                            <span className="truncate">{directory.name}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              void loadMovePickerDirectories(directory.relativePath);
                            }}
                            disabled={isMutating}
                            title={`In ${directory.name} navigieren`}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMoveDialogOpen(false)}
                disabled={isMutating}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isMutating || !moveEntryTarget}>
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verschieben
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
