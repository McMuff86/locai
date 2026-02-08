"use client";

import React from 'react';
import {
  Hammer,
  Database,
  FileText,
  RefreshCw,
  Loader2,
  ChevronLeft,
  FolderOpen,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFileBrowser } from '@/hooks/useFileBrowser';
import { FileEntryRow } from './FileEntryRow';
import { FilePreviewDialog } from './FilePreviewDialog';

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

export function FileBrowser() {
  const {
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
    deleteFile,
    refresh,
  } = useFileBrowser();

  // Track which entry is being previewed for download
  const previewEntry = filePreview
    ? entries.find(e => e.name === filePreview.filename)
    : null;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
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

      {/* Root Selector */}
      {!currentRoot && (
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
      )}

      {/* Breadcrumbs */}
      {currentRoot && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-sm flex-shrink-0 flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
              <button
                onClick={() => navigateToBreadcrumb(crumb.path)}
                className={`px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors truncate max-w-[150px] ${
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

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* File List */}
      {currentRoot && (
        <div className="flex-1 min-h-0">
          {isLoading && entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Laden…</p>
            </div>
          ) : entries.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="rounded-full p-4 bg-muted/50">
                <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Noch keine Dateien
                </p>
                <p className="text-xs text-muted-foreground">
                  Dieses Verzeichnis ist leer.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-0.5 pr-2">
                {entries.map((entry) => (
                  <FileEntryRow
                    key={entry.relativePath}
                    entry={entry}
                    onNavigate={navigateTo}
                    onPreview={previewFile}
                    onDelete={deleteFile}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Preview Dialog */}
      <FilePreviewDialog
        open={filePreview !== null}
        onOpenChange={(open) => { if (!open) closePreview(); }}
        preview={filePreview}
        isLoading={isPreviewLoading}
        rootId={previewEntry?.rootId}
        relativePath={previewEntry?.relativePath}
      />
    </div>
  );
}
