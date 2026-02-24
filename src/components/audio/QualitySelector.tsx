"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Zap, Music, Gem } from 'lucide-react';
import { type QualityLevel, QUALITY_PRESETS } from '@/lib/aceStep/promptTemplates';

interface QualitySelectorProps {
  value: QualityLevel;
  onChange: (v: QualityLevel) => void;
  estimatedTime: number;
  disabled?: boolean;
}

const QUALITY_ICONS: Record<QualityLevel, React.ReactNode> = {
  draft: <Zap className="h-3.5 w-3.5" />,
  standard: <Music className="h-3.5 w-3.5" />,
  high: <Gem className="h-3.5 w-3.5" />,
};

const QUALITY_COLORS: Record<QualityLevel, string> = {
  draft: 'text-amber-500 border-amber-500/30 bg-amber-500/5',
  standard: 'text-primary border-primary/30 bg-primary/5',
  high: 'text-violet-500 border-violet-500/30 bg-violet-500/5',
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function QualitySelector({ value, onChange, estimatedTime, disabled }: QualitySelectorProps) {
  const levels: QualityLevel[] = ['draft', 'standard', 'high'];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Qualität
        </label>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {formatTime(estimatedTime)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {levels.map((level) => {
          const preset = QUALITY_PRESETS[level];
          const isActive = value === level;
          return (
            <button
              key={level}
              type="button"
              disabled={disabled}
              onClick={() => onChange(level)}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-all',
                'hover:bg-muted/30',
                disabled && 'pointer-events-none opacity-50',
                isActive
                  ? QUALITY_COLORS[level]
                  : 'border-border/40 text-muted-foreground',
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="quality-indicator"
                  className={cn(
                    'absolute inset-0 rounded-lg border-2',
                    level === 'draft' && 'border-amber-500/40',
                    level === 'standard' && 'border-primary/40',
                    level === 'high' && 'border-violet-500/40',
                  )}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {QUALITY_ICONS[level]}
              <span className="text-[10px] font-medium">{preset.name}</span>
              <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                {preset.numSteps} steps
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
