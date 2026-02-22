"use client";

import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Loader2, Music, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AudioFile {
  filename: string;
  size: number;
  createdAt: string;
}

export interface AudioHistoryHandle {
  refresh: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AudioHistory = forwardRef<AudioHistoryHandle>(function AudioHistory(_props, ref) {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/audio-files');
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setFiles(data.files);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({ refresh: fetchFiles }), [fetchFiles]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Music className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Noch keine Audio-Dateien vorhanden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.filename}
          className="bg-card border border-border rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate font-mono">{file.filename}</span>
            <span className="flex-shrink-0 ml-2">
              {formatSize(file.size)} &middot; {formatDate(file.createdAt)}
            </span>
          </div>
          <AudioPlayer
            src={`/api/audio/${file.filename}`}
            compact
            downloadable
          />
        </div>
      ))}
    </div>
  );
});
