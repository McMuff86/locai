import { AlertTriangle, CheckCircle2, CircleDot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeRunStatus } from '@/lib/flow/types';

interface NodeRuntimeBadgeProps {
  status?: NodeRunStatus;
}

export function NodeRuntimeBadge({ status = 'idle' }: NodeRuntimeBadgeProps) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        processing
      </span>
    );
  }

  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        done
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
        <AlertTriangle className="h-3 w-3" />
        error
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-muted/60 bg-muted/20 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground',
      )}
    >
      <CircleDot className="h-3 w-3" />
      idle
    </span>
  );
}

export default NodeRuntimeBadge;
