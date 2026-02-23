"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Repeat, PaintBucket, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/audio-utils';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { SaveMenu } from '@/components/audio/SaveMenu';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface WaveformPlayerProps {
  src: string;
  title?: string;
  downloadable?: boolean;
  onSendToRemix?: (src: string) => void;
  onSendToRepaint?: (src: string) => void;
  onOpenInStudio?: (src: string) => void;
}

export function WaveformPlayer({ src, title, downloadable = true, onSendToRemix, onSendToRepaint, onOpenInStudio }: WaveformPlayerProps) {
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformData = useRef<Float32Array | null>(null);
  const animFrameRef = useRef<number>(0);
  const [waveformReady, setWaveformReady] = useState(false);

  // Decode audio for waveform
  useEffect(() => {
    let cancelled = false;

    async function loadWaveform() {
      try {
        const res = await fetch(src);
        const buffer = await res.arrayBuffer();
        const audioCtx = new AudioContext();
        const decoded = await audioCtx.decodeAudioData(buffer);
        audioCtx.close();

        if (cancelled) return;

        const raw = decoded.getChannelData(0);
        const samples = 200;
        const blockSize = Math.floor(raw.length / samples);
        const peaks = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = start; j < start + blockSize && j < raw.length; j++) {
            sum += Math.abs(raw[j]);
          }
          peaks[i] = sum / blockSize;
        }

        const max = Math.max(...peaks);
        if (max > 0) {
          for (let i = 0; i < peaks.length; i++) {
            peaks[i] /= max;
          }
        }

        waveformData.current = peaks;
        setWaveformReady(true);
      } catch {
        waveformData.current = null;
      }
    }

    loadWaveform();
    return () => { cancelled = true; };
  }, [src]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const data = waveformData.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const barWidth = w / data.length;
    const progress = duration > 0 ? currentTime / duration : 0;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < data.length; i++) {
      const x = i * barWidth;
      const barHeight = Math.max(data[i] * (h * 0.8), 1);
      const y = (h - barHeight) / 2;

      const isPlayed = i / data.length <= progress;
      ctx.fillStyle = isPlayed
        ? 'oklch(0.75 0.17 182 / 0.9)'
        : 'oklch(0.5 0.02 240 / 0.3)';

      ctx.beginPath();
      ctx.roundRect(x + 0.5, y, Math.max(barWidth - 1, 1), barHeight, 1);
      ctx.fill();
    }
  }, [currentTime, duration]);

  useEffect(() => {
    if (!waveformReady) return;
    drawWaveform();
  }, [waveformReady, drawWaveform]);

  // Animation loop for waveform
  useEffect(() => {
    if (!playing || !waveformReady) return;

    const animate = () => {
      drawWaveform();
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing, waveformReady, drawWaveform]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    seek(ratio * duration);
  }, [duration, seek]);

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
      className="space-y-2 outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>

        {/* Waveform or fallback progress */}
        <div className="flex-1 min-w-0">
          {waveformReady ? (
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-10 cursor-pointer rounded"
            />
          ) : (
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-primary rounded-full transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Time */}
        <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground min-w-[70px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1.5 pl-12">
        {title && (
          <span className="text-xs text-muted-foreground truncate flex-1">{title}</span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {/* Speed */}
          <button
            onClick={cycleSpeed}
            className="text-[10px] tabular-nums text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30"
            title="Wiedergabegeschwindigkeit"
          >
            {playbackRate}x
          </button>

          {/* Loop */}
          <button
            onClick={toggleLoop}
            className={cn(
              'px-1.5 py-0.5 rounded transition-colors',
              loop ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
            )}
            title="Wiederholen"
          >
            <Repeat className="h-3 w-3" />
          </button>

          {onSendToRemix && (
            <button
              onClick={() => onSendToRemix(src)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30"
              title="Zum Remix senden"
            >
              <Repeat className="h-3 w-3" />
              Remix
            </button>
          )}
          {onSendToRepaint && (
            <button
              onClick={() => onSendToRepaint(src)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30"
              title="Zum Repaint senden"
            >
              <PaintBucket className="h-3 w-3" />
              Repaint
            </button>
          )}
          {onOpenInStudio && (
            <button
              onClick={() => onOpenInStudio(src)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30"
              title="Im Studio öffnen"
            >
              <Headphones className="h-3 w-3" />
              Studio
            </button>
          )}
          {downloadable && <SaveMenu src={src} variant="label" />}
        </div>
      </div>
    </div>
  );
}
