"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { WaveformPlayer } from './WaveformPlayer';

interface ResultCardProps {
  url: string;
  label: string;
  index: number;
  onSendToRemix?: (src: string) => void;
  onSendToRepaint?: (src: string) => void;
  onOpenInStudio?: (src: string) => void;
}

export function ResultCard({ url, label, index, onSendToRemix, onSendToRepaint, onOpenInStudio }: ResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4"
    >
      <WaveformPlayer
        src={url}
        title={label}
        downloadable
        onSendToRemix={onSendToRemix}
        onSendToRepaint={onSendToRepaint}
        onOpenInStudio={onOpenInStudio}
      />
    </motion.div>
  );
}
