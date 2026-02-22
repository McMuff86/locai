"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface GenerationStatusProps {
  statusText: string;
  loading: boolean;
}

export function GenerationStatus({ statusText, loading }: GenerationStatusProps) {
  if (!loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center gap-3 py-8"
    >
      {/* Animated spinner with glow */}
      <div className="relative">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="absolute inset-0 h-8 w-8 rounded-full bg-primary/20 blur-md animate-pulse" />
      </div>

      {/* Status text */}
      <p className="text-sm text-muted-foreground">
        {statusText || 'Generiere...'}
      </p>

      {/* Progress bar animation */}
      <div className="w-48 h-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ width: '40%' }}
        />
      </div>
    </motion.div>
  );
}
