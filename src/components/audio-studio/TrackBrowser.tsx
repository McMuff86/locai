"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Music, Clock, HardDrive } from 'lucide-react';
import { useStudioStore } from '@/stores/studioStore';

interface AudioFile {
  filename: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TrackBrowserProps {
  compact?: boolean;
  onTrackSelected?: () => void;
}

export function TrackBrowser({ compact, onTrackSelected }: TrackBrowserProps) {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const loadTrack = useStudioStore((s) => s.loadTrack);
  const activeTrack = useStudioStore((s) => s.activeTrack);

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

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSelect = useCallback(
    (file: AudioFile) => {
      const url = `/api/audio/${file.filename}`;
      loadTrack(url, file.filename);
      onTrackSelected?.();
    },
    [loadTrack, onTrackSelected],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-foreground/30" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Music className="h-6 w-6 text-foreground/20 mb-2" />
        <p className="text-xs text-foreground/40">
          Noch keine Audio-Dateien vorhanden.
        </p>
        <p className="text-[10px] text-foreground/25 mt-1">
          Generiere Musik im &quot;Musik&quot; Tab.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {files.map((file) => {
        const isActive = activeTrack?.url === `/api/audio/${file.filename}`;
        return (
          <button
            key={file.filename}
            onClick={() => handleSelect(file)}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
              isActive
                ? 'bg-[oklch(0.75_0.17_182/0.12)] text-[oklch(0.85_0.10_182)]'
                : 'hover:bg-[oklch(0.15_0.005_240)] text-foreground/70 hover:text-foreground/90'
            }`}
          >
            <p className="font-mono text-[11px] truncate leading-tight">
              {file.filename}
            </p>
            {!compact && (
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 text-[10px] text-foreground/35">
                  <HardDrive className="h-2.5 w-2.5" />
                  {formatSize(file.size)}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-foreground/35">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDate(file.createdAt)}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
