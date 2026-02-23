"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Headphones } from 'lucide-react';
import { useStudioStore } from '@/stores/studioStore';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { TransportBar } from './TransportBar';
import { WaveformDisplay } from './WaveformDisplay';
import { StudioControls } from './StudioControls';
import { Equalizer } from './Equalizer';
import { FrequencyVisualizer } from './FrequencyVisualizer';

export function AudioStudio() {
  const { activeTrack, playing, setPlaying, setCurrentTime, currentTime, duration,
    loopEnabled, setLoopEnabled, loopStart, loopEnd, setLoopRegion,
    volume, setVolume, muted, setMuted, waveformZoom, setWaveformZoom,
  } = useStudioStore();

  const { seek, getFrequencyData, getWaveformData } = useAudioEngine();
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);

  // Load waveform data when track changes
  useEffect(() => {
    if (!activeTrack) {
      setWaveformData(null);
      return;
    }

    let cancelled = false;
    getWaveformData(activeTrack.url).then((data) => {
      if (!cancelled) setWaveformData(data);
    });
    return () => { cancelled = true; };
  }, [activeTrack, getWaveformData]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (!activeTrack) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setPlaying(!playing);
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          setLoopEnabled(!loopEnabled);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, currentTime - (e.shiftKey ? 1 : 5)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(duration, currentTime + (e.shiftKey ? 1 : 5)));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(6, volume + 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(-60, volume - 1));
          break;
        case '+':
        case '=':
          e.preventDefault();
          setWaveformZoom(Math.min(400, waveformZoom + 20));
          break;
        case '-':
          e.preventDefault();
          setWaveformZoom(Math.max(20, waveformZoom - 20));
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          setMuted(!muted);
          break;
        case '0':
          e.preventDefault();
          seek(0);
          if (!playing) setCurrentTime(0);
          break;
        case '[':
          e.preventDefault();
          if (loopEnabled && loopStart > 0) {
            setLoopRegion(Math.max(0, loopStart - 0.5), loopEnd);
          }
          break;
        case ']':
          e.preventDefault();
          if (loopEnabled && loopEnd < duration) {
            setLoopRegion(loopStart, Math.min(duration, loopEnd + 0.5));
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTrack, playing, currentTime, duration, loopEnabled, loopStart, loopEnd,
    volume, muted, waveformZoom, setPlaying, seek, setLoopEnabled, setLoopRegion,
    setVolume, setMuted, setWaveformZoom, setCurrentTime]);

  const handleSeek = useCallback((time: number) => {
    seek(time);
  }, [seek]);

  // Empty state
  if (!activeTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-center">
        <div className="relative mb-4">
          <div className="absolute inset-0 blur-2xl bg-[oklch(0.75_0.17_182/0.1)] rounded-full" />
          <Headphones className="relative h-12 w-12 text-foreground/20" />
        </div>
        <p className="text-sm text-foreground/40 mb-1">Keinen Track geladen</p>
        <p className="text-xs text-foreground/25">
          Generiere einen Track im &quot;Musik&quot; Tab oder wähle einen aus dem Verlauf.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] rounded-xl border border-border/30 bg-[oklch(0.06_0.005_240)] overflow-hidden">
      {/* Transport Bar */}
      <TransportBar />

      {/* Waveform — 40% of remaining height */}
      <div className="flex-[4] min-h-0 border-b border-border/20">
        <WaveformDisplay waveformData={waveformData} onSeek={handleSeek} />
      </div>

      {/* Bottom section */}
      <div className="flex-[6] min-h-0 grid grid-cols-[280px_1fr] border-t border-border/20">
        {/* Left column: Controls + EQ */}
        <div className="border-r border-border/20 overflow-y-auto">
          <StudioControls />
          <div className="border-t border-border/20 p-4">
            <label className="block text-[10px] font-medium text-foreground/50 uppercase tracking-wider mb-2">
              Equalizer
            </label>
            <div className="h-[140px]">
              <Equalizer />
            </div>
          </div>
        </div>

        {/* Right column: Visualizer + Info */}
        <div className="flex flex-col min-h-0">
          {/* Frequency Visualizer */}
          <div className="flex-1 min-h-0 p-4">
            <label className="block text-[10px] font-medium text-foreground/50 uppercase tracking-wider mb-2">
              Frequenz
            </label>
            <div className="h-[calc(100%-24px)]">
              <FrequencyVisualizer getFrequencyData={getFrequencyData} />
            </div>
          </div>

          {/* Track Info */}
          <div className="border-t border-border/20 px-4 py-3">
            <div className="flex items-center gap-3">
              <Headphones className="h-4 w-4 text-[oklch(0.75_0.17_182)] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-foreground/80 truncate">{activeTrack.title}</p>
                <p className="text-[10px] text-foreground/30 font-mono tabular-nums">
                  {duration > 0 ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : '--:--'}
                  {' · '}Studio
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
