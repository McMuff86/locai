"use client";

import React, { useRef } from 'react';
import { FileText, RefreshCw, Loader2, FolderOpen, Upload } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentUpload, type DocumentUploadHandle } from './DocumentUpload';
import { DocumentCard } from './DocumentCard';
import { useDocuments } from '@/hooks/useDocuments';
import { IndexStatus } from '@/lib/documents/types';

// ---------------------------------------------------------------------------
// Skeleton for loading state
// ---------------------------------------------------------------------------

function DocumentCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentManager() {
  const {
    documents,
    isUploading,
    isLoading,
    uploadDocument,
    deleteDocument,
    renameDocument,
    copyDocument,
    refresh,
    readyCount,
  } = useDocuments();

  const uploadRef = useRef<DocumentUploadHandle>(null);

  const indexingCount = documents.filter(
    (d) => d.status === IndexStatus.Indexing || d.status === IndexStatus.Pending,
  ).length;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Dokumente</h1>
            <p className="text-xs text-muted-foreground">
              {documents.length === 0
                ? 'Lade Dokumente hoch, um sie im Chat als Kontext zu nutzen.'
                : `${readyCount} bereit${indexingCount > 0 ? ` · ${indexingCount} in Bearbeitung` : ''}`}
            </p>
          </div>
        </div>

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
      </div>

      {/* Upload Zone */}
      <div className="flex-shrink-0">
        <DocumentUpload ref={uploadRef} onUpload={uploadDocument} isUploading={isUploading} />
      </div>

      {/* Indexing Progress Bar */}
      {indexingCount > 0 && (
        <div className="flex-shrink-0 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm text-blue-600 dark:text-blue-400">
                {indexingCount} {indexingCount === 1 ? 'Dokument wird' : 'Dokumente werden'} indexiert…
              </span>
            </div>
            <span className="text-xs text-blue-500/70 tabular-nums">
              {readyCount}/{documents.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-blue-500/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500/60 transition-all duration-500 relative overflow-hidden"
              style={{
                width: `${documents.length > 0 ? (readyCount / documents.length) * 100 : 0}%`,
              }}
            >
              <div
                className="absolute inset-0 animate-shimmer"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 min-h-0">
        {isLoading && documents.length === 0 ? (
          <div className="space-y-2 pr-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <DocumentCardSkeleton key={i} />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="rounded-full p-5 bg-muted/40 border border-border/30">
              <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <p className="text-sm font-medium text-muted-foreground">
                Noch keine Dokumente
              </p>
              <p className="text-xs text-muted-foreground/70">
                Lade PDF, Markdown, Text oder Code-Dateien hoch, um sie im Chat
                als Kontext zu nutzen.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 mt-2"
              onClick={() => uploadRef.current?.triggerFileInput()}
            >
              <Upload className="h-4 w-4" />
              Erstes Dokument hochladen
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-2">
              <AnimatePresence initial={false}>
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onDelete={deleteDocument}
                    onRename={renameDocument}
                    onCopy={copyDocument}
                  />
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
