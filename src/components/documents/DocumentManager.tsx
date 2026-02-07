"use client";

import React from 'react';
import { FileText, RefreshCw, Loader2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DocumentUpload } from './DocumentUpload';
import { DocumentCard } from './DocumentCard';
import { useDocuments } from '@/hooks/useDocuments';
import { IndexStatus } from '@/lib/documents/types';

export function DocumentManager() {
  const {
    documents,
    isUploading,
    isLoading,
    uploadDocument,
    deleteDocument,
    refresh,
    readyCount,
  } = useDocuments();

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
                : `${readyCount} bereit${indexingCount > 0 ? ` • ${indexingCount} in Bearbeitung` : ''}`}
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
        <DocumentUpload onUpload={uploadDocument} isUploading={isUploading} />
      </div>

      {/* Indexing Progress Bar */}
      {indexingCount > 0 && (
        <div className="flex-shrink-0 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {indexingCount} {indexingCount === 1 ? 'Dokument wird' : 'Dokumente werden'} indexiert…
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-blue-500/10 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-blue-500/50 animate-pulse" />
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 min-h-0">
        {isLoading && documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Dokumente laden…</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full p-4 bg-muted/50">
              <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Noch keine Dokumente
              </p>
              <p className="text-xs text-muted-foreground">
                Lade ein Dokument hoch, um es im Chat als Kontext zu nutzen.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-2">
              {documents.map((doc) => (
                <DocumentCard key={doc.id} document={doc} onDelete={deleteDocument} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
