import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Repeat } from 'lucide-react';
import { NodeRuntimeBadge } from '@/components/flow/nodes/NodeRuntimeBadge';
import { cn } from '@/lib/utils';
import type { LoopNodeData, NodeRunStatus } from '@/lib/flow/types';

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

export function LoopNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as LoopNodeData;
  const modeLabel =
    data.config.mode === 'count'
      ? `${data.config.count}x`
      : data.config.mode === 'condition'
        ? 'Bedingung'
        : 'LLM';

  return (
    <div
      className={cn(
        'w-72 rounded-xl border bg-card/95 text-card-foreground shadow-sm transition-colors',
        runtimeClass(data.runtime?.status),
        selected && 'ring-2 ring-primary/50',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <Repeat className="h-4 w-4 text-orange-400" />
          <span className="text-xs font-semibold tracking-wide">{data.label}</span>
        </span>
        <NodeRuntimeBadge status={data.runtime?.status} />
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="rounded-md border border-orange-500/20 bg-orange-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/80">
          <span className="mr-1 font-medium text-orange-300">Modus:</span>
          {modeLabel}
          <span className="ml-2 text-muted-foreground">
            (max {data.config.maxIterations})
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>{data.config.mode === 'llm' ? data.config.model || 'llama3' : data.config.mode}</span>
        <span className="inline-flex items-center gap-1">
          <Repeat className="h-3 w-3" />
          max {data.config.maxIterations}
        </span>
      </div>

      {/* Main input handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!h-3 !w-3 !bg-orange-400"
        style={{ top: '35%' }}
      />

      {/* Loop-back input handle (left-bottom) */}
      <Handle
        type="target"
        position={Position.Left}
        id="loop-back"
        className="!h-3 !w-3 !bg-orange-300/60"
        style={{ top: '70%' }}
      />

      {/* Body output handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="body"
        className="!h-3 !w-3 !bg-orange-400"
        style={{ top: '35%' }}
      />

      {/* Done output handle (right-bottom) */}
      <Handle
        type="source"
        position={Position.Right}
        id="done"
        className="!h-3 !w-3 !bg-emerald-400"
        style={{ top: '70%' }}
      />
    </div>
  );
}

export default LoopNode;
