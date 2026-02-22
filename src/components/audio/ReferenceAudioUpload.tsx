"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const ACCEPTED_AUDIO = '.wav,.mp3,.flac,.ogg,.m4a';

interface ReferenceAudioUploadProps {
  srcAudioPath: string;
  srcAudioName: string;
  onUploaded: (filePath: string, fileName: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function ReferenceAudioUpload({
  srcAudioPath,
  srcAudioName,
  onUploaded,
  onClear,
  disabled,
}: ReferenceAudioUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/audio-files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Upload fehlgeschlagen');
      }

      onUploaded(data.filePath, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setIsUploading(false);
    }
  }, [onUploaded]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items?.length) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) await uploadFile(files[0]);
  }, [uploadFile]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) await uploadFile(files[0]);
    e.target.value = '';
  }, [uploadFile]);

  // Show uploaded file
  if (srcAudioPath) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Referenz-Audio
        </label>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
        >
          <Music className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs truncate flex-1">{srcAudioName}</span>
          <button
            onClick={onClear}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Referenz-Audio
      </label>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-1.5 rounded-lg py-4 px-3 cursor-pointer transition-all duration-200',
          'border border-dashed border-border/60',
          isDragOver && 'border-primary/60 bg-primary/5 scale-[1.01]',
          !isDragOver && 'hover:border-primary/30 hover:bg-muted/20',
          (isUploading || disabled) && 'pointer-events-none opacity-60',
        )}
      >
        {isUploading ? (
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        ) : (
          <Upload className={cn('h-5 w-5 transition-colors', isDragOver ? 'text-primary' : 'text-muted-foreground')} />
        )}
        <span className="text-xs text-muted-foreground text-center">
          {isUploading ? 'Lade hoch...' : 'Audio-Datei hierher ziehen'}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          WAV, MP3, FLAC, OGG, M4A
        </span>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AUDIO}
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
