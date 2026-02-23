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
  const { eqBands, setEqBand } = useStudioStore();

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

    // Background
    ctx.fillStyle = 'oklch(0.07 0.005 240)';
    ctx.fillRect(0, 0, w, h);

    // Grid lines (horizontal — gain)
    ctx.strokeStyle = 'oklch(0.18 0.005 240)';
    ctx.lineWidth = 0.5;
    for (let g = MIN_GAIN; g <= MAX_GAIN; g += 3) {
      const y = gainToY(g, h);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Zero line
    ctx.strokeStyle = 'oklch(0.25 0.005 240)';
    ctx.lineWidth = 1;
    const zeroY = gainToY(0, h);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();

    // Grid labels
    ctx.fillStyle = 'oklch(0.35 0.01 240)';
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

    // Draw filled area
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
    gradient.addColorStop(0, 'oklch(0.75 0.17 182 / 0.15)');
    gradient.addColorStop(0.5, 'oklch(0.75 0.17 182 / 0.05)');
    gradient.addColorStop(1, 'oklch(0.75 0.17 182 / 0.15)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw curve line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }
    ctx.strokeStyle = 'oklch(0.75 0.17 182 / 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw control points
    points.forEach((p, i) => {
      const isActive = draggingBand === i;

      // Glow
      if (isActive || eqBands[i].gain !== 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, isActive ? 14 : 10, 0, Math.PI * 2);
        ctx.fillStyle = 'oklch(0.75 0.17 182 / 0.1)';
        ctx.fill();
      }

      // Point
      ctx.beginPath();
      ctx.arc(p.x, p.y, isActive ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? 'oklch(0.85 0.17 182)' : 'oklch(0.75 0.17 182)';
      ctx.fill();
      ctx.strokeStyle = 'oklch(0.90 0.05 182)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = 'oklch(0.55 0.02 240)';
      ctx.font = '9px "Geist Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(BAND_LABELS[i], p.x, h - 4);

      // Gain value when active
      if (isActive || eqBands[i].gain !== 0) {
        ctx.fillStyle = 'oklch(0.75 0.17 182)';
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
        className="w-full h-full cursor-pointer rounded-md"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
