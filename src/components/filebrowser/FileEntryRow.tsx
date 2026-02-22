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
  Bot,
  MoreHorizontal,
  Eye,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  onOpenInAgent?: (entry: FileEntry) => void;
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
  onOpenInAgent,
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

  const handleOpenInAgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenInAgent?.(entry);
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

  const menuItems = useMemo(() => {
    const items: { label: string; icon: React.ReactNode; action: (e: React.MouseEvent) => void; variant?: 'destructive'; separator?: boolean }[] = [];

    if (entry.type === 'file') {
      items.push({ label: 'Anzeigen', icon: <Eye className="h-3.5 w-3.5" />, action: (e) => { e.stopPropagation(); onPreview(entry); } });
    }
    if (entry.type === 'directory') {
      items.push({ label: 'Öffnen', icon: <FolderOpen className="h-3.5 w-3.5" />, action: (e) => { e.stopPropagation(); onNavigate(entry.relativePath); } });
    }
    if (entry.type === 'file' && onOpenInAgent) {
      items.push({ label: 'In Agent öffnen', icon: <Bot className="h-3.5 w-3.5" />, action: handleOpenInAgent });
    }
    if (entry.type === 'file') {
      items.push({ label: 'Herunterladen', icon: <Download className="h-3.5 w-3.5" />, action: handleDownload, separator: true });
    }
    if (isWorkspaceEntry) {
      items.push({ label: 'Umbenennen', icon: <Pencil className="h-3.5 w-3.5" />, action: handleRename });
      items.push({ label: 'Verschieben', icon: <Move className="h-3.5 w-3.5" />, action: handleMove });
    }
    if (isWorkspaceEntry && entry.type === 'file') {
      items.push({ label: confirmDelete ? 'Wirklich löschen?' : 'Löschen', icon: <Trash2 className="h-3.5 w-3.5" />, action: handleDelete, variant: 'destructive', separator: true });
    }
    return items;
  }, [entry, isWorkspaceEntry, onOpenInAgent, onPreview, onNavigate, confirmDelete, handleOpenInAgent, handleDownload, handleRename, handleMove, handleDelete]);

  return (
    <div
      className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-150 border ${
        isDropTarget
          ? 'bg-primary/10 border-primary/40 shadow-sm'
          : 'border-transparent hover:bg-muted/40'
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
      <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md bg-muted/40">
        {getFileIcon(entry)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-tight">{entry.name}</p>
        <p className="text-[10px] text-muted-foreground/70 leading-tight">
          {metaText}
          {' · '}
          {formatDate(entry.modifiedAt)}
        </p>
      </div>

      {/* Quick actions: always visible download + agent; rest in menu */}
      <div className="flex-shrink-0 flex items-center gap-0.5">
        {entry.type === 'file' && onOpenInAgent && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            onClick={handleOpenInAgent}
            title="In Agent öffnen"
          >
            <Bot className="h-3 w-3" />
          </Button>
        )}
        {entry.type === 'file' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            onClick={handleDownload}
            title="Herunterladen"
          >
            <Download className="h-3 w-3" />
          </Button>
        )}

        {/* Actions dropdown – always visible */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md text-muted-foreground/60 hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
              title="Aktionen"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            {menuItems.map((item, i) => (
              <React.Fragment key={item.label}>
                {item.separator && i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={item.action}
                  variant={item.variant === 'destructive' ? 'destructive' : 'default'}
                  className="gap-2 text-xs"
                >
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
