"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import { useStudioStore } from '@/stores/studioStore';

interface FrequencyVisualizerProps {
  getFrequencyData: () => Float32Array;
}

export function FrequencyVisualizer({ getFrequencyData }: FrequencyVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const isDarkRef = useRef(true);
  const playing = useStudioStore((s) => s.playing);
  const prevDataRef = useRef<number[]>([]);

  useEffect(() => {
    const check = () => {
      isDarkRef.current = document.documentElement.classList.contains('dark');
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

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
    const dark = isDarkRef.current;
    const data = getFrequencyData();

    const numBars = Math.min(48, data.length);
    const barWidth = (w / numBars) * 0.75;
    const gap = (w / numBars) * 0.25;
    const mirrorH = h * 0.12;
    const mainH = h - mirrorH;

    if (prevDataRef.current.length !== numBars) {
      prevDataRef.current = new Array(numBars).fill(0);
    }

    // Background
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

    // Grid lines
    ctx.strokeStyle = dark ? 'hsl(220 10% 12%)' : 'hsl(220 10% 88%)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      const y = (mainH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    for (let i = 0; i < numBars; i++) {
      const db = data[i + 1] || -100;
      const normalized = Math.max(0, Math.min(1, (db + 100) / 100));

      const prev = prevDataRef.current[i];
      const smoothed = normalized > prev
        ? prev + (normalized - prev) * 0.6
        : prev + (normalized - prev) * 0.15;
      prevDataRef.current[i] = smoothed;

      const barH = smoothed * mainH * 0.9;
      const x = i * (barWidth + gap) + gap / 2;
      const y = mainH - barH;

      const t = i / numBars;
      let hue: number, sat: number, light: number;
      if (t < 0.5) {
        hue = 172 + t * 40;
        sat = 65;
        light = dark ? 55 : 42;
      } else {
        hue = 192 + (t - 0.5) * 80;
        sat = 60;
        light = dark ? 58 : 45;
      }

      const barGrad = ctx.createLinearGradient(x, y, x, mainH);
      barGrad.addColorStop(0, `hsl(${hue} ${sat}% ${light}% / 0.95)`);
      barGrad.addColorStop(1, `hsl(${hue} ${sat}% ${light - 10}% / 0.5)`);
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
      ctx.fill();

      if (smoothed > 0.6) {
        ctx.fillStyle = `hsl(${hue} ${sat}% ${light + 15}% / ${(smoothed - 0.6) * 0.5})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, Math.min(4, barH), [3, 3, 0, 0]);
        ctx.fill();
      }

      const mirrorBarH = barH * 0.25;
      const mirrorGrad = ctx.createLinearGradient(x, mainH, x, mainH + mirrorBarH);
      mirrorGrad.addColorStop(0, `hsl(${hue} ${sat}% ${light}% / 0.12)`);
      mirrorGrad.addColorStop(1, `hsl(${hue} ${sat}% ${light}% / 0)`);
      ctx.fillStyle = mirrorGrad;
      ctx.beginPath();
      ctx.roundRect(x, mainH + 1, barWidth, mirrorBarH, [0, 0, 1, 1]);
      ctx.fill();
    }
  }, [getFrequencyData]);

  useEffect(() => {
    if (!playing) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
          const dark = isDarkRef.current;
          const bgGrad = ctx.createLinearGradient(0, 0, 0, rect.height);
          if (dark) {
            bgGrad.addColorStop(0, 'hsl(220 15% 6%)');
            bgGrad.addColorStop(1, 'hsl(220 15% 4%)');
          } else {
            bgGrad.addColorStop(0, 'hsl(220 15% 97%)');
            bgGrad.addColorStop(1, 'hsl(220 15% 94%)');
          }
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, rect.width, rect.height);
        }
      }
      prevDataRef.current = [];
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
      className="w-full h-full rounded-lg"
    />
  );
}
