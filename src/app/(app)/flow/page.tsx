"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Play, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ConfigPanel } from '@/components/flow/ConfigPanel';
import { FlowCanvas } from '@/components/flow/FlowCanvas';
import { NodeCommandPalette } from '@/components/flow/NodeCommandPalette';
import { NodePalette } from '@/components/flow/NodePalette';
import { RunHistoryPanel } from '@/components/flow/RunHistoryPanel';
import { FlowCompileError, compileVisualWorkflowToPlan } from '@/lib/flow/engine';
import { loadCurrentWorkflow, saveCurrentWorkflow } from '@/lib/flow/serialization';
import { useFlowStore } from '@/stores/flowStore';
import type { WorkflowStatus, WorkflowStreamEvent } from '@/lib/agents/workflowTypes';
import type { FlowNodeKind, NodeRunStatus, WorkflowRunSummary } from '@/lib/flow/types';

export default function FlowPage() {
  const { toast } = useToast();
  const workflow = useFlowStore((state) => state.workflow);
  const selectedRunId = useFlowStore((state) => state.selectedRunId);
  const isHydrated = useFlowStore((state) => state.isHydrated);
  const isRunning = useFlowStore((state) => state.isRunning);
  const runError = useFlowStore((state) => state.runError);
  const loadWorkflow = useFlowStore((state) => state.loadWorkflow);
  const setHydrated = useFlowStore((state) => state.setHydrated);
  const resetNodeRuntime = useFlowStore((state) => state.resetNodeRuntime);
  const setNodeRuntime = useFlowStore((state) => state.setNodeRuntime);
  const setOutputResult = useFlowStore((state) => state.setOutputResult);
  const setRunning = useFlowStore((state) => state.setRunning);
  const setRunError = useFlowStore((state) => state.setRunError);
  const addRunSummary = useFlowStore((state) => state.addRunSummary);
  const applyRunSummary = useFlowStore((state) => state.applyRunSummary);

  const [compileWarnings, setCompileWarnings] = useState<string[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [pendingInsertNodeKind, setPendingInsertNodeKind] = useState<FlowNodeKind | null>(null);
  const streamBufferRef = useRef('');

  const lastRun = useMemo(() => workflow.runs[0] ?? null, [workflow.runs]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const stored = await loadCurrentWorkflow();
        if (!cancelled && stored) {
          loadWorkflow(stored);
        }
      } catch {
        if (!cancelled) {
          toast({
            title: 'Flow-Speicher nicht verfügbar',
            description: 'IndexedDB konnte nicht geladen werden.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [loadWorkflow, setHydrated, toast]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      saveCurrentWorkflow(workflow).catch(() => {
        toast({
          title: 'Flow konnte nicht gespeichert werden',
          description: 'Der aktuelle Stand wurde nicht in IndexedDB gesichert.',
          variant: 'destructive',
        });
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [isHydrated, toast, workflow]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      if (event.key.toLowerCase() !== 'k') {
        return;
      }

      event.preventDefault();
      setIsCommandPaletteOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInsertNodeFromCommand = useCallback((kind: FlowNodeKind) => {
    setPendingInsertNodeKind(kind);
  }, []);

  const handleInsertNodeHandled = useCallback(() => {
    setPendingInsertNodeKind(null);
  }, []);

  const handleSelectRun = useCallback(
    (summary: WorkflowRunSummary) => {
      applyRunSummary(summary);
    },
    [applyRunSummary],
  );

  const handleSaveNow = useCallback(async () => {
    try {
      await saveCurrentWorkflow(workflow);
      toast({ title: 'Flow gespeichert', description: 'Der aktuelle Stand ist lokal gesichert.' });
    } catch {
      toast({
        title: 'Speichern fehlgeschlagen',
        description: 'IndexedDB ist derzeit nicht erreichbar.',
        variant: 'destructive',
      });
    }
  }, [toast, workflow]);

  const handleRun = useCallback(async () => {
    setCompileWarnings([]);
    setRunError(null);
    resetNodeRuntime();
    streamBufferRef.current = '';

    let compiled;
    try {
      compiled = compileVisualWorkflowToPlan(workflow.graph);
      setCompileWarnings(compiled.warnings);
      if (compiled.outputNodeId) {
        setNodeRuntime(compiled.outputNodeId, { status: 'running' });
      }
    } catch (error) {
      const message =
        error instanceof FlowCompileError ? error.message : 'Flow konnte nicht kompiliert werden.';
      setRunError(message);
      toast({
        title: 'Compile-Fehler',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    const runId = `run_${Date.now()}`;
    const startedAt = new Date().toISOString();
    let completedAt: string | undefined;
    let durationMs: number | undefined;
    let totalSteps: number | undefined;
    let finalStatus: WorkflowStatus = 'done';
    let lastError: string | undefined;
    const runNodeStatuses: Record<string, NodeRunStatus> = {};

    for (const node of workflow.graph.nodes) {
      runNodeStatuses[node.id] = 'idle';
    }

    if (compiled.outputNodeId) {
      runNodeStatuses[compiled.outputNodeId] = 'running';
    }

    const setRunNodeStatus = (nodeId: string | undefined, status: NodeRunStatus) => {
      if (!nodeId) {
        return;
      }
      runNodeStatuses[nodeId] = status;
    };

    const processEvent = (event: WorkflowStreamEvent) => {
      switch (event.type) {
        case 'step_start':
          setNodeRuntime(event.stepId, { status: 'running' });
          setRunNodeStatus(event.stepId, 'running');
          totalSteps = Math.max(totalSteps ?? 0, event.stepIndex + 1);
          break;

        case 'step_end':
          setNodeRuntime(event.stepId, {
            status: event.status === 'success' ? 'success' : 'error',
            message: event.status === 'failed' ? 'Step ist fehlgeschlagen.' : undefined,
          });
          setRunNodeStatus(event.stepId, event.status === 'success' ? 'success' : 'error');
          totalSteps = Math.max(totalSteps ?? 0, event.stepIndex + 1);
          break;

        case 'message':
          streamBufferRef.current += event.content;
          setOutputResult(streamBufferRef.current);
          setRunNodeStatus(compiled.outputNodeId ?? undefined, 'success');
          break;

        case 'error':
          finalStatus = 'error';
          lastError = event.message;
          setRunError(event.message);
          if (event.stepId) {
            setNodeRuntime(event.stepId, {
              status: 'error',
              message: event.message,
            });
            setRunNodeStatus(event.stepId, 'error');
          }
          break;

        case 'workflow_end':
          finalStatus = event.status;
          durationMs = event.durationMs;
          totalSteps = event.totalSteps;
          completedAt = new Date().toISOString();
          if (event.status === 'done') {
            setRunNodeStatus(compiled.outputNodeId ?? undefined, 'success');
          } else if (event.status === 'error') {
            setRunNodeStatus(compiled.outputNodeId ?? undefined, 'error');
          }
          break;
      }
    };

    setRunning(true);
    try {
      const response = await fetch('/api/chat/agent/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: compiled.entryMessage,
          model: compiled.model,
          enabledTools: compiled.enabledTools,
          maxSteps: compiled.plan.steps.length,
          enablePlanning: false,
          enableReflection: true,
          conversationHistory: [],
          initialPlan: compiled.plan,
        }),
      });

      if (!response.ok || !response.body) {
        const message = await response.text();
        throw new Error(message || 'Workflow API Antwort fehlgeschlagen.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          try {
            const event = JSON.parse(trimmed) as WorkflowStreamEvent;
            processEvent(event);
          } catch {
            // Ignore malformed NDJSON chunks.
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as WorkflowStreamEvent;
          processEvent(event);
        } catch {
          // Ignore trailing malformed NDJSON chunk.
        }
      }

      toast({
        title: finalStatus === 'done' ? 'Flow abgeschlossen' : 'Flow beendet',
        description:
          finalStatus === 'done'
            ? 'Workflow wurde erfolgreich ausgeführt.'
            : `Workflow endete mit Status: ${finalStatus}`,
        variant: finalStatus === 'done' ? 'default' : 'destructive',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workflow-Ausführung fehlgeschlagen.';
      lastError = message;
      finalStatus = 'error';
      setRunError(message);
      toast({
        title: 'Run fehlgeschlagen',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
      const fallbackCompletedAt = new Date().toISOString();
      addRunSummary({
        id: runId,
        status: finalStatus,
        startedAt,
        completedAt: completedAt ?? fallbackCompletedAt,
        durationMs:
          durationMs ??
          Math.max(0, new Date(completedAt ?? fallbackCompletedAt).getTime() - new Date(startedAt).getTime()),
        totalSteps,
        error: lastError,
        nodeStatuses: runNodeStatuses,
      });
    }
  }, [
    addRunSummary,
    resetNodeRuntime,
    setNodeRuntime,
    setOutputResult,
    setRunError,
    setRunning,
    toast,
    workflow.graph,
  ]);

  if (!isHydrated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Flow wird geladen...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 bg-card/50 px-4 py-2.5">
        <div>
          <h1 className="text-sm font-semibold tracking-wide">LocAI Flow</h1>
          <p className="text-xs text-muted-foreground">
            Wire your AI. See it think.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setIsCommandPaletteOpen(true)}
            disabled={isRunning}
          >
            Add Node
            <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              Ctrl/Cmd+K
            </span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleSaveNow}
            disabled={isRunning}
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {isRunning ? 'Running...' : 'Run'}
          </Button>
        </div>
      </div>

      {(compileWarnings.length > 0 || runError || lastRun) && (
        <div className="border-b border-border/60 bg-background/70 px-4 py-2 text-xs">
          {compileWarnings.length > 0 && (
            <div className="mb-1 text-amber-300">
              Warnings: {compileWarnings.join(' | ')}
            </div>
          )}
          {runError && <div className="mb-1 text-red-300">Run Error: {runError}</div>}
          {lastRun && (
            <div className="text-muted-foreground">
              Last run: {lastRun.status} | {lastRun.durationMs ?? 0} ms | {lastRun.startedAt}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <NodePalette />
          <div className="min-w-0 flex-1">
            <FlowCanvas
              insertNodeKind={pendingInsertNodeKind}
              onInsertNodeHandled={handleInsertNodeHandled}
            />
          </div>
          <ConfigPanel />
        </div>

        <RunHistoryPanel
          runs={workflow.runs}
          selectedRunId={selectedRunId}
          onSelectRun={handleSelectRun}
        />
      </div>

      <NodeCommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        onSelectKind={handleInsertNodeFromCommand}
      />
    </div>
  );
}
