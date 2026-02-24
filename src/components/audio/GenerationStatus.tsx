"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Music } from 'lucide-react';

interface GenerationStatusProps {
  statusText: string;
  loading: boolean;
  progress?: number; // 0-100 from API, optional
  estimatedSeconds?: number;
}

export function GenerationStatus({ statusText, loading, progress, estimatedSeconds }: GenerationStatusProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  if (!loading) return null;

  const estimated = estimatedSeconds ?? 30;
  const fakeProgress = progress ?? Math.min(95, (elapsed / estimated) * 100);
  const remaining = Math.max(0, estimated - elapsed);

  const formatTime = (s: number) => {
    if (s < 60) return `~${Math.ceil(s)}s`;
    return `~${Math.floor(s / 60)}m ${Math.ceil(s % 60)}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm p-5"
    >
      <div className="flex flex-col items-center gap-3">
        {/* Animated icon */}
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <Music className="h-8 w-8 text-primary" />
          </motion.div>
          <div className="absolute inset-0 h-8 w-8 rounded-full bg-primary/20 blur-md animate-pulse" />
        </div>

        {/* Status text */}
        <p className="text-sm font-medium text-foreground">
          {statusText || 'Generiere Musik...'}
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${fakeProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {Math.round(fakeProgress)}%
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {elapsed > 0 && remaining > 0 ? formatTime(remaining) : ''}
            </span>
          </div>
        </div>

        {/* Elapsed */}
        <p className="text-[10px] text-muted-foreground/60 tabular-nums">
          Vergangen: {elapsed}s
        </p>
      </div>
    </motion.div>
  );
}
