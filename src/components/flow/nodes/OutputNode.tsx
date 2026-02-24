import { Handle, Position, type NodeProps } from '@xyflow/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCheck, ChevronDown, ChevronUp, CircleDashed, HardDriveDownload, Loader2 } from 'lucide-react';
import { NodeRuntimeBadge } from '@/components/flow/nodes/NodeRuntimeBadge';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { saveFlowOutput } from '@/lib/flow/saveOutput';
import { useFlowStore } from '@/stores/flowStore';
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

/** Rough token estimate (~4 chars per token for English/German mix) */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function OutputNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as OutputNodeData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const outputStepLabel = useFlowStore((state) => state.outputStepLabel);

  const isStreaming = data.runtime?.status === 'running';
  const hasResult = Boolean(data.config.result?.trim());
  const tokenCount = estimateTokens(data.config.result ?? '');

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, data.config.result]);

  const handleSaveClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!hasResult) {
        toast({ title: 'Kein Ergebnis', description: 'Es gibt noch kein Ergebnis zum Speichern.', variant: 'destructive' });
        return;
      }

      setIsSaving(true);
      const result = await saveFlowOutput(data.config.result!, data.config.filePath);
      setIsSaving(false);

      if (result.success) {
        toast({ title: 'Gespeichert', description: `Ergebnis in ${result.savedPath} gespeichert.` });
      } else {
        toast({ title: 'Speichern fehlgeschlagen', description: result.error, variant: 'destructive' });
      }
    },
    [data.config.result, data.config.filePath, hasResult, toast],
  );

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className={cn(
        'w-80 rounded-xl border bg-card/95 text-card-foreground shadow-sm transition-colors',
        runtimeClass(data.runtime?.status),
        selected && 'ring-2 ring-primary/50',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <CheckCheck className="h-4 w-4 text-amber-300" />
          <span className="text-xs font-semibold tracking-wide">{data.label}</span>
        </span>
        <NodeRuntimeBadge status={data.runtime?.status} />
      </div>

      <div className="space-y-1.5 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">Ergebnis</div>
          {hasResult && (
            <button
              type="button"
              onClick={toggleExpand}
              className="nopan nodrag inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              title={isExpanded ? 'Verkleinern' : 'Erweitern'}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Step label during streaming */}
        {isStreaming && outputStepLabel && (
          <div className="text-[10px] font-medium text-amber-400/80 truncate">
            ▸ {outputStepLabel}
          </div>
        )}

        <div
          ref={scrollRef}
          className={cn(
            'overflow-auto rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/85 transition-[max-height] duration-200',
            isExpanded ? 'max-h-96' : 'max-h-36',
          )}
        >
          {data.config.result?.trim() ? (
            <>
              {data.config.result}
              {isStreaming && (
                <span className="inline-block ml-0.5 w-1.5 h-3 bg-amber-300/80 animate-pulse rounded-sm" />
              )}
            </>
          ) : (
            'Noch kein Ergebnis verfügbar.'
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CircleDashed className="h-3 w-3" />
          sink
        </span>

        {/* Token counter */}
        {hasResult && (
          <span className="text-[9px] tabular-nums text-muted-foreground/70">
            ~{tokenCount.toLocaleString()} tokens
          </span>
        )}

        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          title={
            isSaving
              ? 'Speichern...'
              : !hasResult
                ? 'Kein Ergebnis vorhanden'
                : data.config.filePath?.trim()
                  ? `Ergebnis in ${data.config.filePath} speichern`
                  : 'Ergebnis mit Auto-Name speichern'
          }
          className={cn(
            'nopan nodrag inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors',
            hasResult && !isSaving
              ? 'cursor-pointer text-amber-300 hover:bg-amber-300/15 hover:text-amber-200'
              : 'cursor-default text-muted-foreground/50',
            data.config.saveToFile && 'ring-1 ring-amber-400/30',
          )}
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <HardDriveDownload className="h-3 w-3" />
          )}
          {data.config.saveToFile && <span className="text-[9px]">auto</span>}
        </button>
      </div>

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-amber-300" />
    </div>
  );
}

export default OutputNode;
