"use client";

import React, { useCallback } from 'react';
import { Play, Pause, Square, Repeat, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudioStore } from '@/stores/studioStore';
import { SaveMenu } from '@/components/audio/SaveMenu';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

function formatTimePrecise(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00.0';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const d = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${d}`;
}

function formatPitch(semitones: number): string {
  if (semitones === 0) return '♯ 0';
  if (semitones > 0) return `♯+${semitones}`;
  return `♭${semitones}`;
}

export function TransportBar() {
  const {
    playing, setPlaying, currentTime, duration, playbackRate, setPlaybackRate,
    pitch, setPitch, loopEnabled, setLoopEnabled, activeTrack, setCurrentTime,
  } = useStudioStore();

  const togglePlay = useCallback(() => setPlaying(!playing), [playing, setPlaying]);
  const stop = useCallback(() => { setPlaying(false); setCurrentTime(0); }, [setPlaying, setCurrentTime]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
  }, [playbackRate, setPlaybackRate]);

  const resetPitch = useCallback(() => setPitch(0), [setPitch]);

  return (
    <div className="flex items-center gap-3 px-4 h-12 border-b border-border/40 bg-muted/20 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-1">
        <button
          onClick={togglePlay}
          disabled={!activeTrack}
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg transition-all',
            playing
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              : 'bg-muted/60 text-foreground hover:bg-muted/80',
            !activeTrack && 'opacity-40 cursor-not-allowed',
          )}
          title="Play / Pause (Space)"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <button
          onClick={stop}
          disabled={!activeTrack}
          className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/60 text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Stop (0)"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="w-px h-6 bg-border/30" />

      <span className="font-mono text-xs tabular-nums text-foreground/80 min-w-[120px]">
        {formatTimePrecise(currentTime)}
        <span className="text-muted-foreground/50 mx-1">/</span>
        {formatTimePrecise(duration)}
      </span>

      <div className="w-px h-6 bg-border/30" />

      <button
        onClick={cycleSpeed}
        disabled={!activeTrack}
        className={cn(
          'font-mono text-xs tabular-nums px-2 py-1 rounded-lg transition-colors',
          playbackRate !== 1
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
        )}
        title="Geschwindigkeit"
      >
        {playbackRate}x
      </button>

      <button
        onClick={resetPitch}
        disabled={!activeTrack}
        className={cn(
          'font-mono text-xs tabular-nums px-2 py-1 rounded-lg transition-colors',
          pitch !== 0
            ? 'text-amber-500 bg-amber-500/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
        )}
        title="Pitch (Klicken zum Zurücksetzen)"
      >
        {formatPitch(pitch)}
      </button>

      <button
        onClick={() => setLoopEnabled(!loopEnabled)}
        disabled={!activeTrack}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors',
          loopEnabled
            ? 'text-amber-500 bg-amber-500/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
        )}
        title="Loop (L)"
      >
        <Repeat className="h-3.5 w-3.5" />
      </button>

      <div className="flex-1" />

      <button
        onClick={() => {
          const store = useStudioStore.getState();
          store.setPlaybackRate(1);
          store.setPitch(0);
          store.setLoopEnabled(false);
          store.setVolume(0);
          store.setPan(0);
          store.eqBands.forEach((_, i) => store.setEqBand(i, 0));
        }}
        disabled={!activeTrack}
        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Alle Effekte zurücksetzen"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>

      {activeTrack && <SaveMenu src={activeTrack.url} variant="label" />}
    </div>
  );
}
