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
  const isDarkRef = useRef(true);

  const {
    playing, currentTime, duration, loopEnabled, loopStart, loopEnd,
    setLoopEnabled, setLoopRegion,
  } = useStudioStore();

  // For the rAF render loop we need the latest currentTime without re-creating the callback
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  useEffect(() => {
    const check = () => {
      isDarkRef.current = document.documentElement.classList.contains('dark');
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

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
    // Always read latest currentTime for smooth playhead during rAF
    const time = currentTimeRef.current;
    const progress = duration > 0 ? time / duration : 0;
    const rulerH = 18;
    const waveH = h - rulerH;
    const dark = isDarkRef.current;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (dark) {
      bgGrad.addColorStop(0, 'hsl(220 15% 6%)');
      bgGrad.addColorStop(1, 'hsl(220 15% 4%)');
    } else {
      bgGrad.addColorStop(0, 'hsl(220 15% 97%)');
      bgGrad.addColorStop(1, 'hsl(220 15% 94%)');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Time ruler
    ctx.fillStyle = dark ? 'hsl(220 15% 10%)' : 'hsl(220 15% 90%)';
    ctx.fillRect(0, 0, w, rulerH);

    if (duration > 0) {
      ctx.fillStyle = dark ? 'hsl(220 10% 40%)' : 'hsl(220 10% 55%)';
      ctx.font = '9px "Geist Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';

      const interval = duration > 120 ? 30 : duration > 60 ? 10 : duration > 20 ? 5 : 1;
      for (let t = 0; t <= duration; t += interval) {
        const x = (t / duration) * w;
        ctx.fillRect(x, rulerH - 4, 1, 4);
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
      ctx.fillStyle = dark ? 'hsl(38 90% 60% / 0.08)' : 'hsl(38 90% 50% / 0.12)';
      ctx.fillRect(lsx, rulerH, lex - lsx, waveH);
      ctx.fillStyle = dark ? 'hsl(38 90% 60% / 0.5)' : 'hsl(38 90% 50% / 0.6)';
      ctx.fillRect(lsx, rulerH, 2, waveH);
      ctx.fillRect(lex - 2, rulerH, 2, waveH);
    }

    // Waveform bars
    for (let i = 0; i < waveformData.length; i++) {
      const x = i * barWidth;
      const amplitude = waveformData[i];
      const barH = Math.max(amplitude * (waveH * 0.85), 1);
      const y = rulerH + (waveH - barH) / 2;
      const isPlayed = i / waveformData.length <= progress;

      if (isPlayed) {
        const t = i / waveformData.length;
        const hue = 172 + t * 20;
        ctx.fillStyle = dark
          ? `hsl(${hue} 70% 55% / 0.9)`
          : `hsl(${hue} 60% 40% / 0.85)`;
      } else {
        const t = i / waveformData.length;
        if (amplitude > 0.5) {
          const hue = 172 + t * 20;
          ctx.fillStyle = dark
            ? `hsl(${hue} 30% 40% / 0.25)`
            : `hsl(${hue} 25% 50% / 0.2)`;
        } else {
          ctx.fillStyle = dark
            ? `hsl(220 10% ${25 + amplitude * 15}% / 0.4)`
            : `hsl(220 10% ${55 - amplitude * 15}% / 0.35)`;
        }
      }

      ctx.beginPath();
      ctx.roundRect(x + 0.5, y, Math.max(barWidth - 1, 1), barH, 1);
      ctx.fill();

      // Mirror reflection for played bars
      if (isPlayed && barH > 3) {
        const mirrorH = barH * 0.15;
        const mirrorY = rulerH + (waveH + barH) / 2;
        ctx.fillStyle = dark
          ? 'hsl(172 70% 55% / 0.08)'
          : 'hsl(172 60% 40% / 0.06)';
        ctx.fillRect(x + 0.5, mirrorY, Math.max(barWidth - 1, 1), mirrorH);
      }
    }

    // Playhead
    if (duration > 0) {
      const px = progress * w;
      const glowColor = dark ? 'hsl(172 70% 60%)' : 'hsl(172 60% 45%)';

      const gradient = ctx.createLinearGradient(px - 8, 0, px + 8, 0);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.5, dark ? 'hsl(172 70% 60% / 0.12)' : 'hsl(172 60% 45% / 0.1)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(px - 8, rulerH, 16, waveH);

      ctx.fillStyle = glowColor;
      ctx.fillRect(px - 0.5, 0, 1.5, h);

      ctx.beginPath();
      ctx.arc(px, rulerH, 3, 0, Math.PI * 2);
      ctx.fillStyle = glowColor;
      ctx.fill();
    }

    // Hover line
    if (hoverTime !== null && duration > 0) {
      const hx = (hoverTime / duration) * w;
      ctx.fillStyle = dark ? 'hsl(220 10% 50% / 0.3)' : 'hsl(220 10% 40% / 0.25)';
      ctx.fillRect(hx, rulerH, 1, waveH);
    }
  // Note: currentTime is read via ref inside drawWaveform, not from closure
  }, [waveformData, duration, loopEnabled, loopStart, loopEnd, hoverTime]);

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
        className="w-full h-full cursor-crosshair rounded-lg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      />
      {hoverTime !== null && duration > 0 && (
        <div
          className="absolute top-0 pointer-events-none font-mono text-[10px] text-foreground/60 bg-background/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-border/30 shadow-sm"
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
