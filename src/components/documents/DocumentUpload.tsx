"use client";

import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Upload, FileUp, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { MAX_FILE_SIZE } from '@/lib/documents/constants';
import { motion, AnimatePresence } from 'framer-motion';

// Accepted file extensions
const ACCEPTED_EXTENSIONS = '.pdf,.txt,.md,.ts,.tsx,.js,.py,.css,.html,.json';

export interface DocumentUploadHandle {
  triggerFileInput: () => void;
}

export interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  multiFile?: boolean;
  onMultiUpload?: (files: FileUploadProgress[]) => void;
}

export const DocumentUpload = forwardRef<DocumentUploadHandle, DocumentUploadProps>(
  function DocumentUpload({ onUpload, isUploading, multiFile = false, onMultiUpload }, ref) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [fileQueue, setFileQueue] = useState<FileUploadProgress[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);

    useImperativeHandle(ref, () => ({
      triggerFileInput: () => fileInputRef.current?.click(),
    }));

    const handleFile = useCallback(
      async (file: File) => {
        if (!multiFile) {
          await onUpload(file);
          return;
        }
        
        // Multi-file mode: add to queue
        const newProgress: FileUploadProgress = {
          file,
          progress: 0,
          status: 'pending',
        };
        
        setFileQueue(prev => [...prev, newProgress]);
      },
      [onUpload, multiFile],
    );

    const handleMultipleFiles = useCallback(
      async (files: File[]) => {
        if (!multiFile || files.length === 0) return;

        const initialProgress: FileUploadProgress[] = files.map(file => ({
          file,
          progress: 0,
          status: 'pending' as const,
        }));

        setFileQueue(initialProgress);

        // Process files sequentially
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          setFileQueue(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'uploading', progress: 0 } : item
          ));

          try {
            await onUpload(file);
            setFileQueue(prev => prev.map((item, idx) =>
              idx === i ? { ...item, status: 'success', progress: 100 } : item
            ));
          } catch (error) {
            setFileQueue(prev => prev.map((item, idx) =>
              idx === i ? { 
                ...item, 
                status: 'error', 
                progress: 0,
                error: error instanceof Error ? error.message : 'Upload fehlgeschlagen' 
              } : item
            ));
          }
        }

        // Notify parent component
        if (onMultiUpload) {
          onMultiUpload(fileQueue);
        }

        // Clear queue after 3 seconds
        setTimeout(() => {
          setFileQueue([]);
        }, 3000);
      },
      [multiFile, onUpload, onMultiUpload, fileQueue],
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
        
        if (files.length === 0) return;

        if (multiFile) {
          await handleMultipleFiles(files);
        } else {
          await handleFile(files[0]);
        }
      },
      [handleFile, handleMultipleFiles, multiFile],
    );

    const handleFileInputChange = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        
        if (multiFile) {
          await handleMultipleFiles(fileArray);
        } else {
          await handleFile(fileArray[0]);
        }
        
        e.target.value = '';
      },
      [handleFile, handleMultipleFiles, multiFile],
    );

    const maxSizeMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0);

    return (
      <div className="space-y-4">
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'relative rounded-lg transition-all duration-200',
            'flex flex-col items-center justify-center gap-2 p-5',
            'border border-border/50 bg-muted/10',
            isDragOver && 'border-primary/60 bg-primary/5 shadow-glow-primary scale-[1.01]',
            !isDragOver && 'hover:border-primary/30 hover:bg-muted/20',
            isUploading && 'pointer-events-none opacity-60',
          )}
        >
        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Dokument wird hochgeladen…</p>
          </>
        ) : (
          <>
            <div
              className={cn(
                'rounded-full p-2.5 transition-all duration-200',
                isDragOver ? 'bg-primary/15 scale-110' : 'bg-muted/50',
              )}
            >
              <Upload
                className={cn(
                  'h-6 w-6 transition-colors',
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
                PDF, TXT, Markdown, Code · Max {maxSizeMB} MB
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
          multiple={multiFile}
        />
        </div>

        {/* Multi-File Progress Display */}
        <AnimatePresence>
          {fileQueue.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <div className="text-sm font-medium text-muted-foreground">
                Upload Progress ({fileQueue.filter(f => f.status === 'success').length}/{fileQueue.length})
              </div>
              {fileQueue.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/5"
                >
                  <div className="flex-shrink-0">
                    {item.status === 'success' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    {item.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    )}
                    {item.status === 'pending' && (
                      <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {item.file.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(item.file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                    
                    {item.status === 'uploading' && (
                      <Progress 
                        value={item.progress} 
                        className="mt-1 h-1.5" 
                      />
                    )}
                    
                    {item.error && (
                      <div className="text-xs text-red-500 mt-1">
                        {item.error}
                      </div>
                    )}
                  </div>

                  {item.status === 'error' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFileQueue(prev => prev.filter((_, i) => i !== index));
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
