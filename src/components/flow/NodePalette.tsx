"use client";

import React from 'react';
import { Brain, CircleDot, FileCode2, GitBranch, Plus, Repeat, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FLOW_NODE_DEFINITIONS } from '@/lib/flow/registry';
import type { FlowNodeKind } from '@/lib/flow/types';
import { useFlowStore } from '@/stores/flowStore';

const FLOW_NODE_DRAG_MIME = 'application/locai-flow-node';

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
    case 'condition':
      return GitBranch;
    case 'loop':
      return Repeat;
  }
}

export function NodePalette() {
  const addNode = useFlowStore((state) => state.addNode);
  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, kind: FlowNodeKind) => {
    event.dataTransfer.setData(FLOW_NODE_DRAG_MIME, kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="h-full w-72 border-r border-border/60 bg-card/70 p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">Node Palette</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ziehen oder klicken, um Nodes hinzuzufuegen.
        </p>
      </div>

      <div className="space-y-2">
        {FLOW_NODE_DEFINITIONS.map((definition) => {
          const Icon = iconForKind(definition.kind);
          return (
            <Button
              key={definition.kind}
              variant="outline"
              className="h-auto w-full cursor-grab justify-start gap-2 border-border/70 bg-card/40 px-3 py-2 text-left active:cursor-grabbing"
              draggable
              onDragStart={(event) => handleDragStart(event, definition.kind)}
              onClick={() => addNode(definition.kind)}
            >
              <Icon className={`h-4 w-4 ${definition.accentClass}`} />
              <div className="flex-1">
                <div className="text-xs font-medium">{definition.label}</div>
                <div className="text-[11px] text-muted-foreground">{definition.description}</div>
              </div>
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          );
        })}
      </div>
    </aside>
  );
}

export default NodePalette;
