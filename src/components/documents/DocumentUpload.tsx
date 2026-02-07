"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_FILE_SIZE } from '@/lib/documents/constants';

// Accepted file extensions
const ACCEPTED_EXTENSIONS = '.pdf,.txt,.md,.ts,.tsx,.js,.py,.css,.html,.json';
const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/javascript',
  'text/typescript',
  'text/css',
  'text/html',
  'application/json',
];

interface DocumentUploadProps {
  /** Callback invoked when a file is selected or dropped */
  onUpload: (file: File) => Promise<void>;
  /** Whether an upload is currently in progress (disables interaction) */
  isUploading: boolean;
}

/**
 * Drag-and-drop file upload zone with a file picker fallback.
 * Displays accepted formats and max file size.
 * Shows a spinner during upload.
 */
export function DocumentUpload({ onUpload, isUploading }: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleFile = useCallback(
    async (file: File) => {
      await onUpload(file);
    },
    [onUpload],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items?.length) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounterRef.current = 0;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        // Upload first file only (can extend to multi later)
        await handleFile(files[0]);
      }
    },
    [handleFile],
  );

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await handleFile(files[0]);
      }
      // Reset so same file can be re-selected
      e.target.value = '';
    },
    [handleFile],
  );

  const maxSizeMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-lg border-2 border-dashed transition-colors duration-200',
        'flex flex-col items-center justify-center gap-3 p-8',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/30',
        isUploading && 'pointer-events-none opacity-60',
      )}
    >
      {isUploading ? (
        <>
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Dokument wird hochgeladen…</p>
        </>
      ) : (
        <>
          <div
            className={cn(
              'rounded-full p-3 transition-colors',
              isDragOver ? 'bg-primary/10' : 'bg-muted/50',
            )}
          >
            <Upload
              className={cn(
                'h-8 w-8 transition-colors',
                isDragOver ? 'text-primary' : 'text-muted-foreground',
              )}
            />
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm font-medium">
              {isDragOver ? 'Datei hier ablegen' : 'Dokument hochladen'}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag & Drop oder{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Datei auswählen
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, TXT, Markdown, Code • Max {maxSizeMB} MB
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <FileUp className="h-4 w-4" />
            Datei auswählen
          </Button>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
}
