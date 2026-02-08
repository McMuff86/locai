"use client";

import React, { useMemo, useState } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  FileJson,
  File,
  Download,
  Trash2,
  Pencil,
  Move,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FileEntry } from '@/lib/filebrowser/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(entry: FileEntry) {
  if (entry.type === 'directory') return <Folder className="h-4 w-4 text-blue-500" />;
  const ext = entry.extension;
  if (ext === '.json') return <FileJson className="h-4 w-4 text-yellow-500" />;
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.css', '.html', '.go', '.rs', '.java', '.c', '.cpp', '.rb', '.php', '.sh'].includes(ext)) {
    return <FileCode className="h-4 w-4 text-green-500" />;
  }
  if (['.md', '.txt', '.csv', '.log'].includes(ext)) {
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
}

interface FileEntryRowProps {
  entry: FileEntry;
  canMutate: boolean;
  onNavigate: (relativePath: string) => void;
  onPreview: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => Promise<void>;
  onRename: (entry: FileEntry) => void;
  onMove: (entry: FileEntry) => void;
  onDragStart: (entry: FileEntry) => void;
  onDragEnd: () => void;
  onDropOnDirectory: (targetDirectoryPath: string) => void;
  onDropFilesOnDirectory: (targetDirectoryPath: string, files: File[]) => void;
}

export function FileEntryRow({
  entry,
  canMutate,
  onNavigate,
  onPreview,
  onDelete,
  onRename,
  onMove,
  onDragStart,
  onDragEnd,
  onDropOnDirectory,
  onDropFilesOnDirectory,
}: FileEntryRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);

  const isWorkspaceEntry = canMutate && entry.rootId === 'workspace';

  const metaText = useMemo(() => {
    if (entry.type === 'directory') {
      if (entry.childCount === undefined) return 'Ordner';
      return `${entry.childCount} Einträge`;
    }
    return formatFileSize(entry.size);
  }, [entry]);

  const handleClick = () => {
    if (entry.type === 'directory') {
      onNavigate(entry.relativePath);
    } else {
      onPreview(entry);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams({ rootId: entry.rootId, path: entry.relativePath });
    window.open(`/api/filebrowser/download?${params}`, '_blank');
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await onDelete(entry);
    setConfirmDelete(false);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRename(entry);
  };

  const handleMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMove(entry);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isWorkspaceEntry) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entry.relativePath);
    onDragStart(entry);
  };

  const handleDragEnd = () => {
    setIsDropTarget(false);
    onDragEnd();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isWorkspaceEntry || entry.type !== 'directory') return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDropTarget(true);
  };

  const handleDragLeave = () => {
    setIsDropTarget(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isWorkspaceEntry || entry.type !== 'directory') return;
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      onDropFilesOnDirectory(entry.relativePath, files);
      return;
    }

    onDropOnDirectory(entry.relativePath);
  };

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
        isDropTarget
          ? 'bg-primary/10 border-primary/40'
          : 'border-transparent hover:bg-muted/50'
      }`}
      onClick={handleClick}
      draggable={isWorkspaceEntry}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={entry.type === 'directory' ? 'Doppelklick/Tippen zum Öffnen' : 'Zum Anzeigen klicken'}
    >
      <div className="flex-shrink-0">
        {getFileIcon(entry)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.name}</p>
        <p className="text-xs text-muted-foreground">
          {metaText}
          {' · '}
          {formatDate(entry.modifiedAt)}
        </p>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {entry.type === 'file' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDownload}
            title="Herunterladen"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
        {isWorkspaceEntry && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRename}
              title="Umbenennen"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleMove}
              title="Verschieben"
            >
              <Move className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {isWorkspaceEntry && entry.type === 'file' && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${confirmDelete ? 'text-destructive hover:text-destructive' : ''}`}
            onClick={handleDelete}
            title={confirmDelete ? 'Klicken zum Bestätigen' : 'Löschen'}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
