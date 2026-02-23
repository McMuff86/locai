"use client";

import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Loader2, Music, Repeat, PaintBucket, Headphones } from 'lucide-react';

interface AudioFile {
  filename: string;
  size: number;
  createdAt: string;
}

export interface AudioHistoryHandle {
  refresh: () => void;
}

interface AudioHistoryProps {
  compact?: boolean;
  onSendToRemix?: (audioPath: string, audioName: string) => void;
  onSendToRepaint?: (audioPath: string, audioName: string) => void;
  onOpenInStudio?: (audioPath: string, audioName: string) => void;
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

export const AudioHistory = forwardRef<AudioHistoryHandle, AudioHistoryProps>(
  function AudioHistory({ compact, onSendToRemix, onSendToRepaint, onOpenInStudio }, ref) {
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
      {files.map((file) => {
        const audioSrc = `/api/audio/${file.filename}`;
        return (
          <div
            key={file.filename}
            className={compact
              ? 'border-b border-border/30 pb-2 last:border-0'
              : 'bg-card border border-border rounded-lg p-3 space-y-2'
            }
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate font-mono text-[10px]">{file.filename}</span>
              {!compact && (
                <span className="flex-shrink-0 ml-2">
                  {formatSize(file.size)} &middot; {formatDate(file.createdAt)}
                </span>
              )}
            </div>
            <AudioPlayer
              src={audioSrc}
              compact
              downloadable
            />
            {/* Remix / Repaint / Studio actions */}
            {(onSendToRemix || onSendToRepaint || onOpenInStudio) && (
              <div className="flex items-center gap-1 pt-0.5">
                {onSendToRemix && (
                  <button
                    onClick={() => onSendToRemix(audioSrc, file.filename)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30"
                  >
                    <Repeat className="h-3 w-3" />
                    Remix
                  </button>
                )}
                {onSendToRepaint && (
                  <button
                    onClick={() => onSendToRepaint(audioSrc, file.filename)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30"
                  >
                    <PaintBucket className="h-3 w-3" />
                    Repaint
                  </button>
                )}
                {onOpenInStudio && (
                  <button
                    onClick={() => onOpenInStudio(audioSrc, file.filename)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30"
                  >
                    <Headphones className="h-3 w-3" />
                    Studio
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
