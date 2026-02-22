"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Download, FolderDown, Check, Repeat, PaintBucket } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface WaveformPlayerProps {
  src: string;
  title?: string;
  downloadable?: boolean;
  onSendToRemix?: (src: string) => void;
  onSendToRepaint?: (src: string) => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function extractFilename(src: string): string {
  const parts = src.split('/');
  return decodeURIComponent(parts[parts.length - 1] || 'audio.flac');
}

export function WaveformPlayer({ src, title, downloadable = true, onSendToRemix, onSendToRepaint }: WaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformData = useRef<Float32Array | null>(null);
  const animFrameRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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

        // Downsample to ~200 bars
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

        // Normalize
        const max = Math.max(...peaks);
        if (max > 0) {
          for (let i = 0; i < peaks.length; i++) {
            peaks[i] /= max;
          }
        }

        waveformData.current = peaks;
        setWaveformReady(true);
      } catch {
        // Fallback to simple progress bar
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

      if (isPlayed) {
        // LocAI cyan
        ctx.fillStyle = 'oklch(0.75 0.17 182 / 0.9)';
      } else {
        ctx.fillStyle = 'oklch(0.5 0.02 240 / 0.3)';
      }

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

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2">
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
      {(downloadable || onSendToRemix || onSendToRepaint) && (
        <div className="flex items-center gap-1.5 pl-12">
          {title && (
            <span className="text-xs text-muted-foreground truncate flex-1">{title}</span>
          )}
          <div className="flex items-center gap-1 ml-auto">
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
            {downloadable && <SaveMenu src={src} />}
          </div>
        </div>
      )}
    </div>
  );
}

function SaveMenu({ src }: { src: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
        <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30">
          <Download className="h-3 w-3" />
          Speichern
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem asChild>
          <a href={src} download className="flex items-center gap-2 cursor-pointer">
            <Download className="h-4 w-4" />
            Speichern unter...
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSaveToWorkspace} disabled={saving} className="flex items-center gap-2">
          {saved ? <Check className="h-4 w-4 text-green-500" /> : <FolderDown className="h-4 w-4" />}
          {saving ? 'Speichere...' : saved ? 'Gespeichert!' : 'Im Workspace speichern'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
