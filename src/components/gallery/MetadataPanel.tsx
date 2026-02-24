"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Copy, Check, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { ImageMetadata } from './types';

interface MetadataPanelProps {
  metadata: ImageMetadata | null;
  isLoading: boolean;
  onClose: () => void;
}

export function MetadataPanel({
  metadata,
  isLoading,
  onClose,
}: MetadataPanelProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copyPrompt = async () => {
    if (metadata?.positivePrompt) {
      await navigator.clipboard.writeText(metadata.positivePrompt);
      setCopiedPrompt(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="absolute right-0 top-0 bottom-0 w-96 bg-card/95 backdrop-blur-sm overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Metadaten</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : metadata ? (
          <>
            {/* Positive Prompt */}
            {metadata.positivePrompt && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    Prompt
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={copyPrompt}
                  >
                    {copiedPrompt ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="text-sm bg-muted p-2 rounded max-h-32 overflow-y-auto">
                  {metadata.positivePrompt}
                </p>
              </div>
            )}
            
            {/* Negative Prompt */}
            {metadata.negativePrompt && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Negative Prompt
                </label>
                <p className="text-sm bg-muted p-2 rounded max-h-24 overflow-y-auto text-muted-foreground">
                  {metadata.negativePrompt}
                </p>
              </div>
            )}
            
            {/* Generation Settings */}
            <div className="grid grid-cols-2 gap-2">
              {metadata.model && (
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Model</label>
                  <p className="text-sm truncate">{metadata.model}</p>
                </div>
              )}
              {metadata.seed !== undefined && (
                <div>
                  <label className="text-xs text-muted-foreground">Seed</label>
                  <p className="text-sm font-mono">{metadata.seed}</p>
                </div>
              )}
              {metadata.steps !== undefined && (
                <div>
                  <label className="text-xs text-muted-foreground">Steps</label>
                  <p className="text-sm">{metadata.steps}</p>
                </div>
              )}
              {metadata.cfg !== undefined && (
                <div>
                  <label className="text-xs text-muted-foreground">CFG Scale</label>
                  <p className="text-sm">{metadata.cfg}</p>
                </div>
              )}
              {metadata.sampler && (
                <div>
                  <label className="text-xs text-muted-foreground">Sampler</label>
                  <p className="text-sm">{metadata.sampler}</p>
                </div>
              )}
              {metadata.scheduler && (
                <div>
                  <label className="text-xs text-muted-foreground">Scheduler</label>
                  <p className="text-sm">{metadata.scheduler}</p>
                </div>
              )}
              {metadata.width && metadata.height && (
                <div>
                  <label className="text-xs text-muted-foreground">Dimensions</label>
                  <p className="text-sm">{metadata.width} × {metadata.height}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Keine Metadaten verfügbar</p>
            <p className="text-xs mt-1">PNG mit ComfyUI-Workflow benötigt</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

