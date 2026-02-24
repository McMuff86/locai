"use client";

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { useStudioStore } from '@/stores/studioStore';

export function StudioControls() {
  const { volume, setVolume, pan, setPan, pitch, setPitch } = useStudioStore();

  return (
    <div className="space-y-5 p-4">
      {/* Volume */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Volume
          </label>
          <span className="font-mono text-[10px] tabular-nums text-foreground/60">
            {volume > -60 ? `${volume > 0 ? '+' : ''}${volume.toFixed(1)} dB` : '-∞'}
          </span>
        </div>
        <Slider
          min={-60}
          max={6}
          step={0.5}
          value={[volume]}
          onValueChange={([v]) => setVolume(v)}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/40 font-mono">
          <span>-60</span>
          <span>-30</span>
          <span>0</span>
          <span>+6</span>
        </div>
      </div>

      {/* Pan */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Pan
          </label>
          <span className="font-mono text-[10px] tabular-nums text-foreground/60">
            {pan === 0 ? 'C' : pan < 0 ? `L${Math.abs(Math.round(pan * 100))}` : `R${Math.round(pan * 100)}`}
          </span>
        </div>
        <Slider
          min={-1}
          max={1}
          step={0.01}
          value={[pan]}
          onValueChange={([v]) => setPan(v)}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/40 font-mono">
          <span>L</span>
          <span>C</span>
          <span>R</span>
        </div>
      </div>

      {/* Pitch */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Pitch
          </label>
          <span className="font-mono text-[10px] tabular-nums text-foreground/60">
            {pitch > 0 ? `+${pitch}` : pitch} st
          </span>
        </div>
        <Slider
          min={-12}
          max={12}
          step={1}
          value={[pitch]}
          onValueChange={([v]) => setPitch(v)}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/40 font-mono">
          <span>-12</span>
          <span>0</span>
          <span>+12</span>
        </div>
      </div>
    </div>
  );
}
