"use client";

import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { GenerationMode } from '@/hooks/useAudioGenerator';

interface ParameterPanelProps {
  mode: GenerationMode;
  duration: number;
  bpm: number;
  batch: number;
  seed: string;
  instrumental: boolean;
  thinking: boolean;
  numSteps: number;
  cfgScale: number;
  strength: number;
  repaintStart: number;
  repaintEnd: number;
  onDurationChange: (v: number) => void;
  onBpmChange: (v: number) => void;
  onBatchChange: (v: number) => void;
  onSeedChange: (v: string) => void;
  onInstrumentalChange: (v: boolean) => void;
  onThinkingChange: (v: boolean) => void;
  onNumStepsChange: (v: number) => void;
  onCfgScaleChange: (v: number) => void;
  onStrengthChange: (v: number) => void;
  onRepaintStartChange: (v: number) => void;
  onRepaintEndChange: (v: number) => void;
  disabled?: boolean;
}

export function ParameterPanel({
  mode, duration, bpm, batch, seed, instrumental,
  thinking, numSteps, cfgScale, strength, repaintStart, repaintEnd,
  onDurationChange, onBpmChange, onBatchChange, onSeedChange,
  onInstrumentalChange, onThinkingChange, onNumStepsChange,
  onCfgScaleChange, onStrengthChange, onRepaintStartChange, onRepaintEndChange,
  disabled,
}: ParameterPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const showAdvancedSection = mode !== 'simple';

  return (
    <div className="space-y-4">
      {/* Duration */}
      <div>
        <label className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
          <span>Dauer</span>
          <span className="text-foreground tabular-nums">{duration}s</span>
        </label>
        <Slider
          min={5} max={300} step={5}
          value={[duration]}
          onValueChange={(v) => onDurationChange(v[0])}
          disabled={disabled}
        />
      </div>

      {/* BPM */}
      <div>
        <label className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
          <span>BPM</span>
          <span className="text-foreground tabular-nums">{bpm}</span>
        </label>
        <Slider
          min={60} max={200} step={1}
          value={[bpm]}
          onValueChange={(v) => onBpmChange(v[0])}
          disabled={disabled}
        />
      </div>

      {/* Batch (Varianten) */}
      <div>
        <label className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
          <span>Varianten</span>
          <span className="text-foreground tabular-nums">{batch}</span>
        </label>
        <Slider
          min={1} max={5} step={1}
          value={[batch]}
          onValueChange={(v) => onBatchChange(v[0])}
          disabled={disabled}
        />
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {batch > 1 ? `${batch} Varianten mit unterschiedlichen Seeds` : '1 Variante'}
        </p>
      </div>

      {/* Seed */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Seed (optional)</label>
        <Input
          type="number"
          placeholder="Zufällig"
          value={seed}
          onChange={(e) => onSeedChange(e.target.value)}
          disabled={disabled}
          className="h-8 text-xs"
        />
      </div>

      {/* Instrumental Toggle */}
      <label className={cn(
        'flex items-center gap-2 cursor-pointer group',
        disabled && 'pointer-events-none opacity-50',
      )}>
        <button
          type="button"
          role="switch"
          aria-checked={instrumental}
          onClick={() => onInstrumentalChange(!instrumental)}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
            'border border-border',
            instrumental ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              instrumental ? 'translate-x-4' : 'translate-x-0.5',
            )}
            style={{ marginTop: '1px' }}
          />
        </button>
        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          Instrumental (keine Vocals)
        </span>
      </label>

      {/* Advanced Parameters (collapsible) */}
      {showAdvancedSection && (
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-180')} />
            Erweiterte Parameter
          </button>

          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-3">
                  {/* Think */}
                  <label className={cn(
                    'flex items-center gap-2 cursor-pointer group',
                    disabled && 'pointer-events-none opacity-50',
                  )}>
                    <input
                      type="checkbox"
                      checked={thinking}
                      onChange={(e) => onThinkingChange(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                      disabled={disabled}
                    />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      LM Planning (Think)
                    </span>
                  </label>

                  {/* Steps */}
                  <div>
                    <label className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                      <span>Inference Steps</span>
                      <span className="text-foreground tabular-nums">{numSteps}</span>
                    </label>
                    <Slider
                      min={1} max={200} step={1}
                      value={[numSteps]}
                      onValueChange={(v) => onNumStepsChange(v[0])}
                      disabled={disabled}
                    />
                  </div>

                  {/* CFG Scale */}
                  <div>
                    <label className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                      <span>CFG Scale</span>
                      <span className="text-foreground tabular-nums">{cfgScale}</span>
                    </label>
                    <Slider
                      min={1} max={15} step={0.5}
                      value={[cfgScale]}
                      onValueChange={(v) => onCfgScaleChange(v[0])}
                      disabled={disabled}
                    />
                  </div>

                  {/* Strength (Remix only) */}
                  {mode === 'remix' && (
                    <div>
                      <label className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                        <span>Remix-Stärke</span>
                        <span className="text-foreground tabular-nums">{strength.toFixed(2)}</span>
                      </label>
                      <Slider
                        min={0} max={1} step={0.05}
                        value={[strength]}
                        onValueChange={(v) => onStrengthChange(v[0])}
                        disabled={disabled}
                      />
                    </div>
                  )}

                  {/* Repaint Start/End */}
                  {mode === 'repaint' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Start (s)</label>
                        <Input
                          type="number"
                          value={repaintStart}
                          onChange={(e) => onRepaintStartChange(parseFloat(e.target.value) || 0)}
                          disabled={disabled}
                          className="h-8 text-xs"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Ende (s)</label>
                        <Input
                          type="number"
                          value={repaintEnd}
                          onChange={(e) => onRepaintEndChange(parseFloat(e.target.value) || -1)}
                          disabled={disabled}
                          className="h-8 text-xs"
                          placeholder="-1 = Ende"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
