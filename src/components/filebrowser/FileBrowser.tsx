"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFileBrowser } from '@/hooks/useFileBrowser';
import { FileEntryRow } from './FileEntryRow';
import { FilePreviewDialog } from './FilePreviewDialog';
import type { FileEntry } from '@/lib/filebrowser/types';

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

export function FileBrowser() {
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

  const canMutate = currentRoot?.id === 'workspace';

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

  const handleCreateFile = async () => {
    if (!canMutate) return;
    const name = window.prompt('Name der neuen Datei (z.B. note.md):', 'neue-datei.txt');
    if (!name) return;
    await createFile(name.trim());
  };

  const handleCreateFolder = async () => {
    if (!canMutate) return;
    const name = window.prompt('Name des neuen Ordners:', 'neuer-ordner');
    if (!name) return;
    await createFolder(name.trim());
  };

  const handleRename = async (entry: FileEntry) => {
    if (!canMutate) return;
    const name = window.prompt(`Neuer Name für "${entry.name}":`, entry.name);
    if (!name || name.trim() === entry.name) return;
    await renameEntry(entry, name.trim());
  };

  const handleMove = async (entry: FileEntry) => {
    if (!canMutate) return;
    const target = window.prompt(
      `Zielordner relativ zum Workspace für "${entry.name}" (leer = root):`,
      currentPath,
    );
    if (target === null) return;
    await moveEntry(entry, target.trim());
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
                    onPreview={previewFile}
                    onDelete={deleteFile}
                    onRename={handleRename}
                    onMove={handleMove}
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
      />
    </div>
  );
}
