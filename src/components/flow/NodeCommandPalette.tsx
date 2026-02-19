"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, CircleDot, FileCode2, Rows3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FLOW_NODE_DEFINITIONS } from '@/lib/flow/registry';
import type { FlowNodeKind } from '@/lib/flow/types';
import { cn } from '@/lib/utils';

interface NodeCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectKind: (kind: FlowNodeKind) => void;
}

function iconForKind(kind: FlowNodeKind) {
  switch (kind) {
    case 'input':
      return CircleDot;
    case 'agent':
      return Brain;
    case 'template':
      return FileCode2;
    case 'output':
      return Rows3;
  }
}

export function NodeCommandPalette({ open, onOpenChange, onSelectKind }: NodeCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredNodes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return FLOW_NODE_DEFINITIONS;
    }

    return FLOW_NODE_DEFINITIONS.filter((definition) =>
      [definition.kind, definition.label, definition.description]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (activeIndex < filteredNodes.length) {
      return;
    }

    setActiveIndex(Math.max(0, filteredNodes.length - 1));
  }, [activeIndex, filteredNodes.length]);

  const handleSubmit = (kind: FlowNodeKind) => {
    onSelectKind(kind);
    onOpenChange(false);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredNodes.length === 0) {
        return;
      }
      setActiveIndex((prev) => Math.min(prev + 1, filteredNodes.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredNodes.length === 0) {
        return;
      }
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = filteredNodes[activeIndex];
      if (selected) {
        handleSubmit(selected.kind);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-4 py-3">
          <DialogTitle className="text-sm">Node Palette</DialogTitle>
          <DialogDescription className="text-xs">
            Suche einen Node und fuege ihn mit Enter in die Viewport-Mitte ein.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-4">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Input, Agent, Template..."
            aria-label="Node suchen"
          />

          <div className="max-h-72 overflow-y-auto rounded-md border border-border/60">
            {filteredNodes.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Keine Nodes gefunden.
              </div>
            ) : (
              filteredNodes.map((definition, index) => {
                const Icon = iconForKind(definition.kind);
                return (
                  <button
                    key={definition.kind}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 border-b border-border/40 px-3 py-2 text-left last:border-b-0',
                      'hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none',
                      activeIndex === index && 'bg-accent/70',
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSubmit(definition.kind)}
                  >
                    <Icon className={`h-4 w-4 ${definition.accentClass}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{definition.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{definition.description}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NodeCommandPalette;
