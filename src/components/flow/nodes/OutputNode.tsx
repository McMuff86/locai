import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CheckCheck, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeRunStatus, OutputNodeData } from '@/lib/flow/types';

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

export function OutputNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as OutputNodeData;

  return (
    <div
      className={cn(
        'w-80 rounded-xl border bg-card/95 text-card-foreground shadow-sm transition-colors',
        runtimeClass(data.runtime?.status),
        selected && 'ring-2 ring-primary/50',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <CheckCheck className="h-4 w-4 text-amber-300" />
        <span className="text-xs font-semibold tracking-wide">{data.label}</span>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="text-[11px] text-muted-foreground">Ergebnis</div>
        <div className="max-h-36 overflow-auto rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/85">
          {data.config.result?.trim() || 'Noch kein Ergebnis verfügbar.'}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CircleDashed className="h-3 w-3" />
          sink
        </span>
      </div>

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-amber-300" />
    </div>
  );
}

export default OutputNode;
