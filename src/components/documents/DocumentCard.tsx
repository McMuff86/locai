"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  File,
  FileText,
  FileCode,
  FileType,
  MoreHorizontal,
  Pencil,
  Copy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Document } from '@/lib/documents/types';
import { IndexStatus, DocumentType } from '@/lib/documents/types';
import { ChunkPreview } from './ChunkPreview';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileIcon(type: DocumentType): {
  icon: React.ReactNode;
  bgClass: string;
} {
  switch (type) {
    case DocumentType.PDF:
      return {
        icon: <FileText className="h-5 w-5 text-red-500" />,
        bgClass: 'bg-red-500/10 border-red-500/20',
      };
    case DocumentType.TXT:
      return {
        icon: <FileType className="h-5 w-5 text-muted-foreground" />,
        bgClass: 'bg-muted/50 border-border',
      };
    case DocumentType.MD:
      return {
        icon: <FileText className="h-5 w-5 text-emerald-500" />,
        bgClass: 'bg-emerald-500/10 border-emerald-500/20',
      };
    case DocumentType.CODE:
      return {
        icon: <FileCode className="h-5 w-5 text-blue-500" />,
        bgClass: 'bg-blue-500/10 border-blue-500/20',
      };
    default:
      return {
        icon: <File className="h-5 w-5 text-muted-foreground" />,
        bgClass: 'bg-muted/50 border-border/30',
      };
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
  document: Document;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, newName: string) => Promise<void>;
  onCopy: (id: string) => Promise<void>;
}

export function DocumentCard({ document: doc, onDelete, onRename, onCopy }: DocumentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(doc.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select filename (without extension) when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const dotIndex = editName.lastIndexOf('.');
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRename = async () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== doc.name) {
      await onRename(doc.id, trimmed);
    } else {
      setEditName(doc.name);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(doc.id);
    setIsDeleting(false);
    setShowDeleteDialog(false);
  };

  const startEditing = () => {
    setEditName(doc.name);
    // Small delay to ensure dropdown has closed before focusing input
    setTimeout(() => setIsEditing(true), 50);
  };

  const { icon, bgClass } = getFileIcon(doc.type);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
        className={cn(
          'group flex items-center gap-3 rounded-lg border border-border p-3',
          'transition-all duration-150',
          'hover:bg-muted/30 hover:shadow-sm hover:border-border/60',
          doc.status === IndexStatus.Error && 'border-red-500/30 bg-red-500/5',
        )}
      >
        {/* File Type Icon */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border',
            bgClass,
          )}
        >
          {icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditName(doc.name);
                  }
                }}
                onBlur={handleRename}
                className="h-7 text-sm font-medium px-1.5 max-w-xs"
              />
            ) : (
              <h4 className="text-sm font-medium truncate">{doc.name}</h4>
            )}
            {!isEditing && <StatusBadge status={doc.status} error={doc.error} />}
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
          {doc.status === IndexStatus.Ready && doc.chunkCount > 0 && (
            <ChunkPreview documentId={doc.id} chunkCount={doc.chunkCount} />
          )}
        </div>

        {/* Context Menu */}
        <div className="flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={startEditing}>
                <Pencil className="h-4 w-4" />
                Umbenennen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCopy(doc.id)}>
                <Copy className="h-4 w-4" />
                Kopieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument löschen?</DialogTitle>
            <DialogDescription>
              &ldquo;{doc.name}&rdquo; und alle zugehörigen Embeddings werden
              unwiderruflich gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
