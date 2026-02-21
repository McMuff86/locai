import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { NodeRuntimeBadge } from '@/components/flow/nodes/NodeRuntimeBadge';
import { cn } from '@/lib/utils';
import type { ConditionNodeData, NodeRunStatus } from '@/lib/flow/types';

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

export function ConditionNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as ConditionNodeData;
  const preview =
    data.config.mode === 'llm'
      ? data.config.prompt?.trim() || 'Kein Prompt gesetzt'
      : data.config.expression?.trim() || 'Kein Ausdruck gesetzt';

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
          <GitBranch className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-semibold tracking-wide">{data.label}</span>
        </span>
        <NodeRuntimeBadge status={data.runtime?.status} />
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="rounded-md border border-violet-500/20 bg-violet-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/80">
          <span className="mr-1 font-medium text-violet-300">
            {data.config.mode === 'llm' ? 'LLM:' : 'Expr:'}
          </span>
          {preview.length > 80 ? `${preview.slice(0, 80)}...` : preview}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>{data.config.mode === 'llm' ? data.config.model || 'llama3' : 'Expression'}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          true
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          false
        </span>
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-violet-400"
      />

      {/* True output handle (top-right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!h-3 !w-3 !bg-emerald-400"
        style={{ top: '35%' }}
      />

      {/* False output handle (bottom-right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!h-3 !w-3 !bg-red-400"
        style={{ top: '70%' }}
      />
    </div>
  );
}

export default ConditionNode;
