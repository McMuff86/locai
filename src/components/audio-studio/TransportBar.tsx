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
    <div className="flex items-center gap-3 px-4 h-12 border-b border-border/40 bg-[oklch(0.08_0.005_240)] flex-shrink-0">
      {/* Play / Stop */}
      <div className="flex items-center gap-1">
        <button
          onClick={togglePlay}
          disabled={!activeTrack}
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
            playing
              ? 'bg-[oklch(0.75_0.17_182)] text-[oklch(0.08_0.005_240)] hover:bg-[oklch(0.70_0.17_182)]'
              : 'bg-muted/40 text-foreground hover:bg-muted/60',
            !activeTrack && 'opacity-40 cursor-not-allowed',
          )}
          title="Play / Pause (Space)"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <button
          onClick={stop}
          disabled={!activeTrack}
          className="flex items-center justify-center h-8 w-8 rounded-md bg-muted/40 text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Stop (0)"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-border/30" />

      {/* Time display */}
      <span className="font-mono text-xs tabular-nums text-foreground/80 min-w-[120px]">
        {formatTimePrecise(currentTime)}
        <span className="text-foreground/30 mx-1">/</span>
        {formatTimePrecise(duration)}
      </span>

      {/* Divider */}
      <div className="w-px h-6 bg-border/30" />

      {/* Speed */}
      <button
        onClick={cycleSpeed}
        disabled={!activeTrack}
        className={cn(
          'font-mono text-xs tabular-nums px-2 py-1 rounded-md transition-colors',
          playbackRate !== 1
            ? 'text-[oklch(0.75_0.17_182)] bg-[oklch(0.75_0.17_182/0.1)]'
            : 'text-foreground/60 hover:text-foreground hover:bg-muted/30',
        )}
        title="Geschwindigkeit"
      >
        {playbackRate}x
      </button>

      {/* Pitch */}
      <button
        onClick={resetPitch}
        disabled={!activeTrack}
        className={cn(
          'font-mono text-xs tabular-nums px-2 py-1 rounded-md transition-colors',
          pitch !== 0
            ? 'text-[oklch(0.78_0.19_80)] bg-[oklch(0.78_0.19_80/0.1)]'
            : 'text-foreground/60 hover:text-foreground hover:bg-muted/30',
        )}
        title="Pitch (Klicken zum Zurücksetzen)"
      >
        {formatPitch(pitch)}
      </button>

      {/* Loop toggle */}
      <button
        onClick={() => setLoopEnabled(!loopEnabled)}
        disabled={!activeTrack}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
          loopEnabled
            ? 'text-[oklch(0.78_0.19_80)] bg-[oklch(0.78_0.19_80/0.1)]'
            : 'text-foreground/60 hover:text-foreground hover:bg-muted/30',
        )}
        title="Loop (L)"
      >
        <Repeat className="h-3.5 w-3.5" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Reset */}
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
        className="text-foreground/40 hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Alle Effekte zurücksetzen"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>

      {/* Save */}
      {activeTrack && <SaveMenu src={activeTrack.url} variant="label" />}
    </div>
  );
}
