"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Music, Sliders, Repeat, PaintBucket } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenerationMode } from '@/hooks/useAudioGenerator';

interface ModeSelectorProps {
  value: GenerationMode;
  onChange: (mode: GenerationMode) => void;
  disabled?: boolean;
}

const MODES = [
  { value: 'simple' as const, label: 'Einfach', icon: Music, description: 'Schnelle Generierung' },
  { value: 'custom' as const, label: 'Erweitert', icon: Sliders, description: 'Alle Parameter' },
  { value: 'remix' as const, label: 'Remix', icon: Repeat, description: 'Audio remixen' },
  { value: 'repaint' as const, label: 'Repaint', icon: PaintBucket, description: 'Abschnitt neu' },
];

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Modus
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = value === mode.value;
          return (
            <button
              key={mode.value}
              onClick={() => onChange(mode.value)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-xs transition-colors',
                'border border-transparent',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="mode-active"
                  className="absolute inset-0 rounded-lg border border-primary/50 bg-primary/10"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className="h-4 w-4 relative z-10" />
              <span className="font-medium relative z-10">{mode.label}</span>
              <span className="text-[10px] text-muted-foreground relative z-10">{mode.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
