"use client";

import React, { useState } from 'react';
import { Trash2, Loader2, CheckCircle2, AlertCircle, Clock, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Document } from '@/lib/documents/types';
import { IndexStatus, DocumentType } from '@/lib/documents/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileIcon(type: DocumentType): React.ReactNode {
  switch (type) {
    case DocumentType.PDF:
      return <span className="text-lg">📄</span>;
    case DocumentType.TXT:
      return <span className="text-lg">📝</span>;
    case DocumentType.MD:
      return <span className="text-lg">📋</span>;
    case DocumentType.CODE:
      return <span className="text-lg">💻</span>;
    default:
      return <File className="h-5 w-5 text-muted-foreground" />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function StatusBadge({ status, error }: { status: IndexStatus; error?: string }) {
  switch (status) {
    case IndexStatus.Pending:
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">
          <Clock className="h-3 w-3" />
          Wartend
        </span>
      );
    case IndexStatus.Indexing:
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Loader2 className="h-3 w-3 animate-spin" />
          Indexierung…
        </span>
      );
    case IndexStatus.Ready:
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Bereit
        </span>
      );
    case IndexStatus.Error:
      return (
        <span
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
          title={error}
        >
          <AlertCircle className="h-3 w-3" />
          Fehler
        </span>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DocumentCardProps {
  /** The document to display */
  document: Document;
  /** Callback to delete a document by ID */
  onDelete: (id: string) => Promise<void>;
}

/**
 * Renders a single document row with type icon, status badge,
 * metadata (size, chunk count, date), and a delete button with
 * confirmation.
 */
export function DocumentCard({ document: doc, onDelete }: DocumentCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-reset after 3s
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    setIsDeleting(true);
    await onDelete(doc.id);
    setIsDeleting(false);
    setConfirmDelete(false);
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors',
        'hover:bg-muted/30',
        doc.status === IndexStatus.Error && 'border-red-500/30 bg-red-500/5',
      )}
    >
      {/* File Type Icon */}
      <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50">
        {getFileIcon(doc.type)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium truncate">{doc.name}</h4>
          <StatusBadge status={doc.status} error={doc.error} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(doc.size)}
          </span>
          {doc.chunkCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {doc.chunkCount} Chunks
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDate(doc.uploadedAt)}
          </span>
        </div>
        {doc.status === IndexStatus.Error && doc.error && (
          <p className="text-xs text-red-500 mt-1 truncate">{doc.error}</p>
        )}
      </div>

      {/* Delete Button */}
      <div className="flex-shrink-0">
        <Button
          variant={confirmDelete ? 'destructive' : 'ghost'}
          size="icon"
          className={cn(
            'h-8 w-8 transition-opacity',
            !confirmDelete && 'opacity-0 group-hover:opacity-100',
          )}
          onClick={handleDelete}
          disabled={isDeleting}
          title={confirmDelete ? 'Klick zum Bestätigen' : 'Dokument löschen'}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
