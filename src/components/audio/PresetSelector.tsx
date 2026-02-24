"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  BUILT_IN_PRESETS,
  loadCustomPresets,
  saveCustomPresets,
  type MusicPreset,
} from './presets';

interface PresetSelectorProps {
  onApply: (preset: MusicPreset) => void;
  onSaveCurrent: () => MusicPreset;
  disabled?: boolean;
}

export function PresetSelector({ onApply, onSaveCurrent, disabled }: PresetSelectorProps) {
  const [customPresets, setCustomPresets] = useState<MusicPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    setCustomPresets(loadCustomPresets());
  }, []);

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    const preset = onSaveCurrent();
    const newPreset: MusicPreset = {
      ...preset,
      id: `custom-${Date.now()}`,
      name: saveName.trim(),
      emoji: '⭐',
      custom: true,
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setSaveName('');
    setShowSaveDialog(false);
  }, [saveName, onSaveCurrent, customPresets]);

  const handleDelete = useCallback((id: string) => {
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    saveCustomPresets(updated);
  }, [customPresets]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Presets
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={() => setShowSaveDialog(!showSaveDialog)}
          disabled={disabled}
        >
          <Bookmark className="h-3 w-3" />
          Speichern
        </Button>
      </div>

      {/* Save dialog */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 pb-2">
              <Input
                placeholder="Preset-Name..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="h-7 text-xs flex-1"
                autoFocus
              />
              <Button size="sm" className="h-7 px-2" onClick={handleSave} disabled={!saveName.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShowSaveDialog(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {BUILT_IN_PRESETS.map((preset) => (
          <motion.button
            key={preset.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onApply(preset)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
              'bg-background/60 backdrop-blur-sm border border-border/40',
              'hover:bg-accent hover:text-accent-foreground transition-colors',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            <span>{preset.emoji}</span>
            <span>{preset.name}</span>
          </motion.button>
        ))}

        {/* Custom presets */}
        {customPresets.map((preset) => (
          <motion.div
            key={preset.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onApply(preset)}
              disabled={disabled}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                'bg-primary/10 backdrop-blur-sm border border-primary/30',
                'hover:bg-primary/20 transition-colors',
                'disabled:opacity-50 disabled:pointer-events-none',
              )}
            >
              <span>{preset.emoji}</span>
              <span>{preset.name}</span>
            </motion.button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(preset.id); }}
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
