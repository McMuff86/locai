"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import { useStudioStore } from '@/stores/studioStore';

interface FrequencyVisualizerProps {
  getFrequencyData: () => Float32Array;
}

export function FrequencyVisualizer({ getFrequencyData }: FrequencyVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const playing = useStudioStore((s) => s.playing);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const data = getFrequencyData();

    // Use only first ~48 bins (skip DC, focus on audible range)
    const numBars = Math.min(48, data.length);
    const barWidth = (w / numBars) * 0.75;
    const gap = (w / numBars) * 0.25;
    const mirrorH = h * 0.15;
    const mainH = h - mirrorH;

    // Background
    ctx.fillStyle = 'oklch(0.07 0.005 240)';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < numBars; i++) {
      // FFT data is in dB (negative values), normalize to 0–1
      const db = data[i + 1] || -100;
      const normalized = Math.max(0, Math.min(1, (db + 100) / 100));
      const barH = normalized * mainH * 0.9;

      const x = i * (barWidth + gap) + gap / 2;
      const y = mainH - barH;

      // Gradient from cyan (low) to amber (high)
      const t = i / numBars;
      const r = Math.round(200 + t * 55);
      const g = Math.round(230 - t * 80);
      const b = Math.round(240 - t * 180);

      // Main bar
      ctx.fillStyle = `rgb(${r} ${g} ${b} / 0.8)`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [2, 2, 0, 0]);
      ctx.fill();

      // Mirror reflection
      ctx.fillStyle = `rgb(${r} ${g} ${b} / 0.15)`;
      ctx.beginPath();
      const mirrorBarH = barH * 0.3;
      ctx.roundRect(x, mainH, barWidth, mirrorBarH, [0, 0, 1, 1]);
      ctx.fill();
    }
  }, [getFrequencyData]);

  useEffect(() => {
    if (!playing) {
      // Draw static (empty) state
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
          ctx.fillStyle = 'oklch(0.07 0.005 240)';
          ctx.fillRect(0, 0, rect.width, rect.height);
        }
      }
      return;
    }

    const animate = () => {
      draw();
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [playing, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-md"
    />
  );
}
