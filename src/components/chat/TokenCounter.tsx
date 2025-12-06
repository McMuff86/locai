"use client";

import React from 'react';
import { Hash, Zap, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TokenStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalDuration: number;
  tokensPerSecond: number;
}

interface TokenCounterProps {
  stats: TokenStats | null;
  contextLimit?: number;
  compact?: boolean;
}

export function TokenCounter({ stats, contextLimit = 128000, compact = false }: TokenCounterProps) {
  if (!stats) return null;

  const contextUsage = contextLimit > 0 
    ? Math.round((stats.totalTokens / contextLimit) * 1000) / 10 
    : 0;

  if (compact) {
    return (
      <motion.div 
        className="flex items-center gap-3 text-xs text-muted-foreground"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="flex items-center gap-1">
          <Hash className="h-3 w-3" />
          {stats.totalTokens.toLocaleString()} tokens
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {stats.tokensPerSecond} t/s
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {stats.totalDuration}s
        </span>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div 
        className="flex flex-wrap items-center gap-4 px-4 py-2 bg-card/30 rounded-lg border border-border/30 text-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {/* Token Counts */}
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Tokens</span>
            <div className="flex items-baseline gap-1">
              <span className="font-semibold">{stats.totalTokens.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">
                ({stats.promptTokens} in / {stats.completionTokens} out)
              </span>
            </div>
          </div>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Speed</span>
            <span className="font-semibold">{stats.tokensPerSecond} t/s</span>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-500" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Duration</span>
            <span className="font-semibold">{stats.totalDuration}s</span>
          </div>
        </div>

        {/* Context Usage */}
        {contextLimit > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">Context</span>
              <span className="font-semibold">{contextUsage}%</span>
            </div>
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div 
                className={`h-full rounded-full ${
                  contextUsage > 80 ? 'bg-red-500' : 
                  contextUsage > 50 ? 'bg-amber-500' : 'bg-primary'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(contextUsage, 100)}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default TokenCounter;

