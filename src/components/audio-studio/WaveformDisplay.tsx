"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStudioStore } from '@/stores/studioStore';

interface WaveformDisplayProps {
  waveformData: Float32Array | null;
  onSeek: (time: number) => void;
}

export function WaveformDisplay({ waveformData, onSeek }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<number | null>(null);

  const {
    playing, currentTime, duration, loopEnabled, loopStart, loopEnd,
    setLoopEnabled, setLoopRegion,
  } = useStudioStore();

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const barWidth = w / waveformData.length;
    const progress = duration > 0 ? currentTime / duration : 0;
    const rulerH = 16;
    const waveH = h - rulerH;

    // Background
    ctx.fillStyle = 'oklch(0.07 0.005 240)';
    ctx.fillRect(0, 0, w, h);

    // Time ruler
    ctx.fillStyle = 'oklch(0.10 0.005 240)';
    ctx.fillRect(0, 0, w, rulerH);

    if (duration > 0) {
      ctx.fillStyle = 'oklch(0.40 0.01 240)';
      ctx.font = '9px "Geist Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';

      const interval = duration > 120 ? 30 : duration > 60 ? 10 : duration > 20 ? 5 : 1;
      for (let t = 0; t <= duration; t += interval) {
        const x = (t / duration) * w;
        // Tick mark
        ctx.fillRect(x, rulerH - 4, 1, 4);
        // Label
        if (t > 0 && t < duration - interval * 0.5) {
          const label = t >= 60
            ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
            : `${t}s`;
          ctx.fillText(label, x, rulerH - 6);
        }
      }
    }

    // Loop region
    if (loopEnabled && loopEnd > loopStart && duration > 0) {
      const lsx = (loopStart / duration) * w;
      const lex = (loopEnd / duration) * w;
      ctx.fillStyle = 'oklch(0.78 0.19 80 / 0.12)';
      ctx.fillRect(lsx, rulerH, lex - lsx, waveH);

      // Loop handles
      ctx.fillStyle = 'oklch(0.78 0.19 80 / 0.6)';
      ctx.fillRect(lsx, rulerH, 2, waveH);
      ctx.fillRect(lex - 2, rulerH, 2, waveH);
    }

    // Waveform bars
    for (let i = 0; i < waveformData.length; i++) {
      const x = i * barWidth;
      const barH = Math.max(waveformData[i] * (waveH * 0.85), 1);
      const y = rulerH + (waveH - barH) / 2;

      const isPlayed = i / waveformData.length <= progress;
      ctx.fillStyle = isPlayed
        ? 'oklch(0.75 0.17 182 / 0.9)'
        : 'oklch(0.5 0.02 240 / 0.3)';

      ctx.beginPath();
      ctx.roundRect(x + 0.5, y, Math.max(barWidth - 1, 1), barH, 1);
      ctx.fill();
    }

    // Playhead
    if (duration > 0) {
      const px = progress * w;
      // Glow
      const gradient = ctx.createLinearGradient(px - 6, 0, px + 6, 0);
      gradient.addColorStop(0, 'oklch(0.75 0.17 182 / 0)');
      gradient.addColorStop(0.5, 'oklch(0.75 0.17 182 / 0.15)');
      gradient.addColorStop(1, 'oklch(0.75 0.17 182 / 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(px - 6, rulerH, 12, waveH);

      // Line
      ctx.fillStyle = 'oklch(0.95 0.02 182)';
      ctx.fillRect(px - 0.5, 0, 1, h);
    }

    // Hover tooltip
    if (hoverTime !== null && duration > 0) {
      const hx = (hoverTime / duration) * w;
      ctx.fillStyle = 'oklch(0.60 0.02 240 / 0.4)';
      ctx.fillRect(hx, rulerH, 1, waveH);
    }
  }, [waveformData, currentTime, duration, loopEnabled, loopStart, loopEnd, hoverTime]);

  // Animation loop
  useEffect(() => {
    if (!waveformData) return;

    if (playing) {
      const animate = () => {
        drawWaveform();
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animFrameRef.current);
    } else {
      drawWaveform();
    }
  }, [playing, waveformData, drawWaveform]);

  // Redraw on any visual state change
  useEffect(() => {
    if (!playing) drawWaveform();
  }, [currentTime, loopEnabled, loopStart, loopEnd, hoverTime, playing, drawWaveform]);

  const getTimeFromX = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(duration, (x / rect.width) * duration));
  }, [duration]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragStart.current = getTimeFromX(e.clientX);
    setIsDragging(true);
  }, [getTimeFromX]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const t = getTimeFromX(e.clientX);
    setHoverTime(t);
    setHoverX(e.clientX - (canvasRef.current?.getBoundingClientRect().left || 0));

    if (isDragging && dragStart.current !== null) {
      const start = Math.min(dragStart.current, t);
      const end = Math.max(dragStart.current, t);
      if (end - start > 0.2) {
        setLoopRegion(start, end);
        setLoopEnabled(true);
      }
    }
  }, [isDragging, getTimeFromX, setLoopRegion, setLoopEnabled]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDragging && dragStart.current !== null) {
      const t = getTimeFromX(e.clientX);
      const start = Math.min(dragStart.current, t);
      const end = Math.max(dragStart.current, t);
      if (end - start <= 0.2) {
        // Click — seek
        onSeek(t);
      }
    }
    setIsDragging(false);
    dragStart.current = null;
  }, [isDragging, getTimeFromX, onSeek]);

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
    if (isDragging) {
      setIsDragging(false);
      dragStart.current = null;
    }
  }, [isDragging]);

  const handleDoubleClick = useCallback(() => {
    setLoopEnabled(false);
    setLoopRegion(0, 0);
  }, [setLoopEnabled, setLoopRegion]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[120px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair rounded-md"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      />

      {/* Hover tooltip */}
      {hoverTime !== null && duration > 0 && (
        <div
          className="absolute top-0 pointer-events-none font-mono text-[10px] text-foreground/60 bg-[oklch(0.12_0.005_240/0.9)] px-1.5 py-0.5 rounded-sm"
          style={{ left: Math.min(hoverX, (containerRef.current?.offsetWidth || 200) - 50), top: 0 }}
        >
          {hoverTime >= 60
            ? `${Math.floor(hoverTime / 60)}:${String(Math.floor(hoverTime % 60)).padStart(2, '0')}.${Math.floor((hoverTime % 1) * 10)}`
            : `${hoverTime.toFixed(1)}s`}
        </div>
      )}
    </div>
  );
}
