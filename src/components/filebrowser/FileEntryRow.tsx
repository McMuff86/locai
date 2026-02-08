"use client";

import React, { useState } from 'react';
import { Folder, FileText, FileCode, FileJson, File, Download, Trash2 } from 'lucide-react';
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
  onNavigate: (relativePath: string) => void;
  onPreview: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => Promise<void>;
}

export function FileEntryRow({ entry, onNavigate, onPreview, onDelete }: FileEntryRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={handleClick}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {getFileIcon(entry)}
      </div>

      {/* Name & Meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.name}</p>
        <p className="text-xs text-muted-foreground">
          {entry.type === 'directory'
            ? `${entry.childCount ?? 0} Einträge`
            : formatFileSize(entry.size)}
          {' · '}
          {formatDate(entry.modifiedAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        {entry.rootId === 'workspace' && entry.type === 'file' && (
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
