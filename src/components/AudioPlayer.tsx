"use client";

import React, { useCallback } from 'react';
import { Play, Pause, Volume2, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/audio-utils';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { SaveMenu } from '@/components/audio/SaveMenu';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Props for the AudioPlayer component. */
interface AudioPlayerProps {
  src: string;
  title?: string;
  downloadable?: boolean;
  compact?: boolean;
}

/**
 * Inline audio player with play/pause, seekable progress bar, time display, and optional download.
 * Supports a compact variant for embedding within chat messages.
 */
export function AudioPlayer({ src, title, downloadable = false, compact = false }: AudioPlayerProps) {
  const {
    audioRef,
    playing,
    currentTime,
    duration,
    playbackRate,
    loop,
    togglePlay,
    seek,
    setPlaybackRate,
    toggleLoop,
  } = useAudioPlayback(src);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  }, [seek]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seek(Math.max(0, currentTime - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      seek(Math.min(duration, currentTime + 5));
    }
  }, [togglePlay, seek, currentTime, duration]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
  }, [playbackRate, setPlaybackRate]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card outline-none focus-visible:ring-1 focus-visible:ring-primary',
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

      {/* Speed */}
      <button
        onClick={cycleSpeed}
        className={cn(
          'flex-shrink-0 tabular-nums text-muted-foreground hover:text-foreground transition-colors',
          compact ? 'text-[10px]' : 'text-xs',
        )}
        title="Wiedergabegeschwindigkeit"
      >
        {playbackRate}x
      </button>

      {/* Loop */}
      <button
        onClick={toggleLoop}
        className={cn(
          'flex-shrink-0 transition-colors',
          loop ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
        title="Wiederholen"
      >
        <Repeat className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </button>

      {/* Download / Save */}
      {downloadable && (
        <SaveMenu src={src} compact={compact} />
      )}
    </div>
  );
}
