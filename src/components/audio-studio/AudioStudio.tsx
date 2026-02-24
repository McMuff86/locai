"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Headphones, Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStudioStore } from '@/stores/studioStore';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { TransportBar } from './TransportBar';
import { WaveformDisplay } from './WaveformDisplay';
import { StudioControls } from './StudioControls';
import { Equalizer } from './Equalizer';
import { FrequencyVisualizer } from './FrequencyVisualizer';
import { TrackBrowser } from './TrackBrowser';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AudioStudio() {
  const { activeTrack, trackLoading, trackError, playing, setPlaying, setCurrentTime, currentTime, duration,
    loopEnabled, setLoopEnabled, loopStart, loopEnd, setLoopRegion,
    volume, setVolume, muted, setMuted, waveformZoom, setWaveformZoom,
  } = useStudioStore();

  const { seek, getFrequencyData, getWaveformData } = useAudioEngine();
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

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

  // Empty state — show track browser
  if (!activeTrack) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm overflow-hidden shadow-sm"
      >
        <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Track auswählen
            </h3>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Wähle einen Track aus dem Audio-Verlauf oder generiere einen im &quot;Musik&quot; Tab.
          </p>
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-2">
            <TrackBrowser />
          </div>
        </ScrollArea>
      </motion.div>
    );
  }

  // Loading state
  if (trackLoading && !waveformData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-[500px] rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm shadow-sm"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Track wird geladen...</p>
        <p className="text-[10px] text-muted-foreground/60 font-mono mt-1 truncate max-w-xs">
          {activeTrack.title}
        </p>
      </motion.div>
    );
  }

  // Error state
  if (trackError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-[500px] rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm shadow-sm"
      >
        <AlertCircle className="h-6 w-6 text-destructive mb-3" />
        <p className="text-sm text-destructive mb-1">Track konnte nicht geladen werden</p>
        <p className="text-[10px] text-muted-foreground/60 mb-4">{trackError}</p>
        <button
          onClick={() => setShowBrowser(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/40 hover:bg-muted/30"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Anderen Track wählen
        </button>
        <AnimatePresence>
          {showBrowser && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 w-full max-w-md overflow-hidden"
            >
              <ScrollArea className="h-[200px]">
                <TrackBrowser compact onTrackSelected={() => setShowBrowser(false)} />
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-[calc(100vh-180px)] rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm overflow-hidden shadow-sm"
    >
      {/* Transport Bar */}
      <TransportBar />

      {/* Loading overlay */}
      <AnimatePresence>
        {trackLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-primary/10"
          >
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-[10px] text-primary">Audio wird geladen...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waveform — 40% of remaining height */}
      <div className="flex-[4] min-h-0 border-b border-border/30">
        <WaveformDisplay waveformData={waveformData} onSeek={handleSeek} />
      </div>

      {/* Bottom section */}
      <div className="flex-[6] min-h-0 grid grid-cols-[280px_1fr] border-t border-border/30">
        {/* Left column: Controls + EQ */}
        <div className="border-r border-border/30 overflow-y-auto">
          <div className="px-4 pt-3 pb-1">
            <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Mixer
            </label>
            <p className="text-[9px] text-muted-foreground/50 mt-0.5">
              Lautstärke, Panorama &amp; Tonhöhe in Echtzeit anpassen
            </p>
          </div>
          <StudioControls />
          <div className="border-t border-border/30 p-4">
            <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
              Equalizer
            </label>
            <p className="text-[9px] text-muted-foreground/50 mb-2">
              Frequenzbänder per Drag &amp; Drop anpassen
            </p>
            <div className="h-[140px]">
              <Equalizer />
            </div>
          </div>
        </div>

        {/* Right column: Visualizer + Info */}
        <div className="flex flex-col min-h-0">
          {/* Frequency Visualizer */}
          <div className="flex-1 min-h-0 p-4">
            <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Frequenz
            </label>
            <div className="h-[calc(100%-24px)]">
              <FrequencyVisualizer getFrequencyData={getFrequencyData} />
            </div>
          </div>

          {/* Track Info */}
          <div className="border-t border-border/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <Headphones className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground/80 truncate">{activeTrack.title}</p>
                <p className="text-[10px] text-muted-foreground/60 font-mono tabular-nums">
                  {duration > 0 ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : '--:--'}
                  {' · '}Studio
                </p>
              </div>
              <button
                onClick={() => setShowBrowser(!showBrowser)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/30"
                title="Track wechseln"
              >
                <FolderOpen className="h-3 w-3" />
                Wechseln
              </button>
            </div>
            <AnimatePresence>
              {showBrowser && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 border-t border-border/30 pt-2 overflow-hidden"
                >
                  <ScrollArea className="h-[180px]">
                    <TrackBrowser compact onTrackSelected={() => setShowBrowser(false)} />
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
