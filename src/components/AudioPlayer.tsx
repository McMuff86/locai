"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Download, FolderDown, Volume2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Props for the AudioPlayer component. */
interface AudioPlayerProps {
  src: string;
  title?: string;
  downloadable?: boolean;
  compact?: boolean;
}

/** Formats a duration in seconds to `m:ss` display format. */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Inline audio player with play/pause, seekable progress bar, time display, and optional download.
 * Supports a compact variant for embedding within chat messages.
 */
export function AudioPlayer({ src, title, downloadable = false, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card',
        compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className={cn(
          'flex-shrink-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
          compact ? 'h-7 w-7' : 'h-9 w-9',
        )}
      >
        {playing ? (
          <Pause className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        ) : (
          <Play className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'ml-0.5')} />
        )}
      </button>

      {/* Title + Volume icon */}
      {title && !compact && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
          <Volume2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{title}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 appearance-none bg-zinc-700 rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
            [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, rgb(63 63 70) ${progress}%)`,
          }}
        />
      </div>

      {/* Time */}
      <span className={cn('flex-shrink-0 tabular-nums text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Download / Save */}
      {downloadable && (
        <SaveMenu src={src} compact={compact} />
      )}
    </div>
  );
}

/** Extract the filename from an audio src URL like /api/audio/my-file.flac */
function extractFilename(src: string): string {
  const parts = src.split('/');
  return decodeURIComponent(parts[parts.length - 1] || 'audio.flac');
}

/** Dropdown menu with "Save as..." (browser download) and "Save to workspace" options. */
function SaveMenu({ src, compact = false }: { src: string; compact?: boolean }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const handleSaveToWorkspace = useCallback(async () => {
    const filename = extractFilename(src);
    setSaving(true);
    try {
      const res = await fetch('/api/audio-files/save-to-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [src]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          <Download className={iconSize} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem asChild>
          <a href={src} download className="flex items-center gap-2 cursor-pointer">
            <Download className="h-4 w-4" />
            Speichern unter...
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSaveToWorkspace}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saved ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <FolderDown className="h-4 w-4" />
          )}
          {saving ? 'Speichere...' : saved ? 'Gespeichert!' : 'Im Workspace speichern'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
