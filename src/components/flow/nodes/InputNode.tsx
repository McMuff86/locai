import { Handle, Position, type NodeProps } from '@xyflow/react';
import React, { useCallback } from 'react';
import { Brackets, CircleDot } from 'lucide-react';
import { NodeRuntimeBadge } from '@/components/flow/nodes/NodeRuntimeBadge';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/stores/flowStore';
import type { InputNodeData, NodeRunStatus } from '@/lib/flow/types';

function runtimeClass(status?: NodeRunStatus): string {
  switch (status) {
    case 'running':
      return 'border-yellow-400/70 shadow-[0_0_0_1px_rgba(250,204,21,0.4)]';
    case 'success':
      return 'border-emerald-400/70 shadow-[0_0_0_1px_rgba(74,222,128,0.4)]';
    case 'error':
      return 'border-red-400/70 shadow-[0_0_0_1px_rgba(248,113,113,0.4)]';
    default:
      return 'border-border/70';
  }
}

export function InputNode({ id, data: rawData, selected }: NodeProps) {
  const data = rawData as InputNodeData;
  const updateNodeConfig = useFlowStore((state) => state.updateNodeConfig);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeConfig(id, { text: e.target.value });
    },
    [id, updateNodeConfig],
  );

  return (
    <div
      className={cn(
        'w-64 rounded-xl border bg-card/95 text-card-foreground shadow-sm transition-colors',
        runtimeClass(data.runtime?.status),
        selected && 'ring-2 ring-primary/50',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <CircleDot className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold tracking-wide">{data.label}</span>
        </span>
        <NodeRuntimeBadge status={data.runtime?.status} />
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="text-[11px] text-muted-foreground">Eingabe</div>
        <textarea
          value={data.config.text ?? ''}
          onChange={handleTextChange}
          placeholder="Keine Eingabe gesetzt"
          className="nopan nodrag nowheel w-full resize-none rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/80 outline-none placeholder:text-muted-foreground/50 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/30"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Brackets className="h-3 w-3" />
          string
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-emerald-400" />
    </div>
  );
}

export default InputNode;
