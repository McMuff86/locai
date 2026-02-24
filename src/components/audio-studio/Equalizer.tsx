"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStudioStore } from '@/stores/studioStore';

const BAND_LABELS = ['60Hz', '250Hz', '1kHz', '4kHz', '12kHz'];
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_GAIN = -12;
const MAX_GAIN = 12;

function freqToX(freq: number, w: number): number {
  return (Math.log10(freq / MIN_FREQ) / Math.log10(MAX_FREQ / MIN_FREQ)) * w;
}

function gainToY(gain: number, h: number): number {
  return h / 2 - (gain / MAX_GAIN) * (h / 2 - 16);
}

function yToGain(y: number, h: number): number {
  const gain = -((y - h / 2) / (h / 2 - 16)) * MAX_GAIN;
  return Math.max(MIN_GAIN, Math.min(MAX_GAIN, Math.round(gain)));
}

export function Equalizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingBand, setDraggingBand] = useState<number | null>(null);
  const isDarkRef = useRef(true);
  const { eqBands, setEqBand } = useStudioStore();

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
    ctx.strokeStyle = dark ? 'hsl(220 10% 15%)' : 'hsl(220 10% 85%)';
    ctx.lineWidth = 0.5;
    for (let g = MIN_GAIN; g <= MAX_GAIN; g += 3) {
      const y = gainToY(g, h);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Zero line
    ctx.strokeStyle = dark ? 'hsl(220 10% 22%)' : 'hsl(220 10% 72%)';
    ctx.lineWidth = 1;
    const zeroY = gainToY(0, h);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();

    // Grid labels
    ctx.fillStyle = dark ? 'hsl(220 10% 35%)' : 'hsl(220 10% 55%)';
    ctx.font = '9px "Geist Mono", ui-monospace, monospace';
    ctx.textAlign = 'right';
    for (const g of [-12, -6, 0, 6, 12]) {
      ctx.fillText(`${g > 0 ? '+' : ''}${g}`, w - 4, gainToY(g, h) - 3);
    }

    // Frequency curve
    const points = eqBands.map((band) => ({
      x: freqToX(band.frequency, w),
      y: gainToY(band.gain, h),
    }));

    // Filled area
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }
    ctx.lineTo(w, points[points.length - 1].y);
    ctx.lineTo(w, zeroY);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    if (dark) {
      gradient.addColorStop(0, 'hsl(172 70% 55% / 0.12)');
      gradient.addColorStop(0.5, 'hsl(172 70% 55% / 0.03)');
      gradient.addColorStop(1, 'hsl(172 70% 55% / 0.12)');
    } else {
      gradient.addColorStop(0, 'hsl(172 60% 40% / 0.15)');
      gradient.addColorStop(0.5, 'hsl(172 60% 40% / 0.04)');
      gradient.addColorStop(1, 'hsl(172 60% 40% / 0.15)');
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // Curve line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }
    ctx.strokeStyle = dark ? 'hsl(172 70% 55% / 0.8)' : 'hsl(172 60% 40% / 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Control points
    const primaryColor = dark ? 'hsl(172 70% 55%)' : 'hsl(172 60% 40%)';
    const primaryLight = dark ? 'hsl(172 70% 70%)' : 'hsl(172 60% 50%)';

    points.forEach((p, i) => {
      const isActive = draggingBand === i;

      if (isActive || eqBands[i].gain !== 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, isActive ? 14 : 10, 0, Math.PI * 2);
        ctx.fillStyle = dark ? 'hsl(172 70% 55% / 0.08)' : 'hsl(172 60% 40% / 0.1)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, isActive ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? primaryLight : primaryColor;
      ctx.fill();
      ctx.strokeStyle = dark ? 'hsl(172 50% 80%)' : 'hsl(172 40% 70%)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = dark ? 'hsl(220 10% 45%)' : 'hsl(220 10% 50%)';
      ctx.font = '9px "Geist Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(BAND_LABELS[i], p.x, h - 4);

      if (isActive || eqBands[i].gain !== 0) {
        ctx.fillStyle = primaryColor;
        ctx.fillText(`${eqBands[i].gain > 0 ? '+' : ''}${eqBands[i].gain}dB`, p.x, p.y - 12);
      }
    });
  }, [eqBands, draggingBand]);

  useEffect(() => {
    draw();
  }, [draw]);

  const findBand = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    let closest = -1;
    let minDist = 20;
    eqBands.forEach((band, i) => {
      const bx = freqToX(band.frequency, w);
      const by = gainToY(band.gain, h);
      const dist = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    return closest;
  }, [eqBands]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const band = findBand(e);
    if (band >= 0) setDraggingBand(band);
  }, [findBand]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingBand === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const gain = yToGain(y, rect.height);
    setEqBand(draggingBand, gain);
  }, [draggingBand, setEqBand]);

  const handleMouseUp = useCallback(() => {
    setDraggingBand(null);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[100px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer rounded-lg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
