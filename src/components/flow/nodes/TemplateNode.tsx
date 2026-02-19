import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileCode2, Variable } from 'lucide-react';
import { NodeRuntimeBadge } from '@/components/flow/nodes/NodeRuntimeBadge';
import { cn } from '@/lib/utils';
import type { NodeRunStatus, TemplateNodeData } from '@/lib/flow/types';

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

export function TemplateNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as TemplateNodeData;

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
          <FileCode2 className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold tracking-wide">{data.label}</span>
        </span>
        <NodeRuntimeBadge status={data.runtime?.status} />
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/80">
          {data.config.template?.trim() || 'Kein Template gesetzt'}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Variable className="h-3 w-3" />
          {'{{vars}}'}
        </span>
      </div>

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-cyan-400" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-cyan-400" />
    </div>
  );
}

export default TemplateNode;
