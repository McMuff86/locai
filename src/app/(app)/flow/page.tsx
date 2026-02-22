"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileText, Loader2, Play, Plus, Save, Square, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { ConfigPanel } from '@/components/flow/ConfigPanel';
import { FlowCanvas } from '@/components/flow/FlowCanvas';
import { NodeCommandPalette } from '@/components/flow/NodeCommandPalette';
import { NodePalette } from '@/components/flow/NodePalette';
import { RunHistoryPanel } from '@/components/flow/RunHistoryPanel';
import { LoggerPanel, type LogEntry } from '@/components/flow/LoggerPanel';
import { DeleteTemplateDialog } from '@/components/flow/DeleteTemplateDialog';
import { SaveFlowDialog } from '@/components/flow/SaveFlowDialog';
import { FlowCompileError, compileVisualWorkflowToPlan } from '@/lib/flow/engine';
import { FLOW_TEMPLATES, type FlowTemplateId } from '@/lib/flow/registry';
import { deleteTemplate as deleteTemplateFromDb, loadAllTemplates, loadCurrentWorkflow, saveCurrentWorkflow } from '@/lib/flow/serialization';
import { useFlowStore } from '@/stores/flowStore';
import type { WorkflowStatus, WorkflowStreamEvent, WorkflowLogEvent } from '@/lib/agents/workflowTypes';
import { saveFlowOutput } from '@/lib/flow/saveOutput';
import type { FlowNodeKind, NodeRunStatus, OutputNodeData, SavedFlowTemplate, WorkflowRunSummary } from '@/lib/flow/types';
import { buildTimelineFromEvents, type TimelineData } from '@/lib/flow/timeline';
import { StepTimeline } from '@/components/flow/StepTimeline';
import {
  downloadAsFile,
  exportWorkflowAsJson,
  exportWorkflowAsYaml,
  getFileExtension,
  importWorkflowFromJson,
  importWorkflowFromYaml,
  readFileAsText,
} from '@/lib/flow/importExport';

export default function FlowPage() {
  const { toast } = useToast();
  const workflow = useFlowStore((state) => state.workflow);
  const selectedRunId = useFlowStore((state) => state.selectedRunId);
  const isHydrated = useFlowStore((state) => state.isHydrated);
  const isRunning = useFlowStore((state) => state.isRunning);
  const runError = useFlowStore((state) => state.runError);
  const loadWorkflow = useFlowStore((state) => state.loadWorkflow);
  const loadTemplate = useFlowStore((state) => state.loadTemplate);
  const setHydrated = useFlowStore((state) => state.setHydrated);
  const resetNodeRuntime = useFlowStore((state) => state.resetNodeRuntime);
  const clearRunningNodeRuntime = useFlowStore((state) => state.clearRunningNodeRuntime);
  const setNodeRuntime = useFlowStore((state) => state.setNodeRuntime);
  const setOutputResult = useFlowStore((state) => state.setOutputResult);
  const setRunning = useFlowStore((state) => state.setRunning);
  const setRunError = useFlowStore((state) => state.setRunError);
  const addRunSummary = useFlowStore((state) => state.addRunSummary);
  const applyRunSummary = useFlowStore((state) => state.applyRunSummary);
  const savedTemplates = useFlowStore((state) => state.savedTemplates);
  const activeTemplateId = useFlowStore((state) => state.activeTemplateId);
  const activeTemplateName = useFlowStore((state) => state.activeTemplateName);
  const setSavedTemplates = useFlowStore((state) => state.setSavedTemplates);
  const setActiveTemplate = useFlowStore((state) => state.setActiveTemplate);
  const loadSavedTemplate = useFlowStore((state) => state.loadSavedTemplate);

  const [compileWarnings, setCompileWarnings] = useState<string[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [pendingInsertNodeKind, setPendingInsertNodeKind] = useState<FlowNodeKind | null>(null);
  const streamBufferRef = useRef('');
  const runAbortControllerRef = useRef<AbortController | null>(null);
  const [showLastRunInfo, setShowLastRunInfo] = useState(true);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedFlowTemplate | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const timelineEventsRef = useRef<Array<{ stepId: string; label: string; type: 'start' | 'end'; timestampMs: number; status?: string }>>([]);
  const logEntriesRef = useRef<LogEntry[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [activeBottomTab, setActiveBottomTab] = useState<string>('logger');

  const lastRun = useMemo(() => workflow.runs[0] ?? null, [workflow.runs]);
  const runningNodeLabels = useMemo(
    () =>
      workflow.graph.nodes
        .filter((node) => node.data.runtime?.status === 'running')
        .map((node) => node.data.label),
    [workflow.graph.nodes],
  );

  useEffect(() => {
    if (lastRun) {
      setShowLastRunInfo(true);
    }
  }, [lastRun]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const [stored, templates] = await Promise.all([
          loadCurrentWorkflow(),
          loadAllTemplates(),
        ]);
        if (!cancelled) {
          if (stored) {
            loadWorkflow(stored);
          }
          setSavedTemplates(templates);
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
  }, [loadWorkflow, setHydrated, setSavedTemplates, toast]);

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

  // Keyboard shortcut refs (to avoid stale closures)
  const handleSaveRef = useRef<() => void>(() => {});
  const handleRunRef = useRef<() => void>(() => {});

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();

      if (key === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (key === 's') {
        event.preventDefault();
        handleSaveRef.current();
      } else if (key === 'enter' && !isRunning) {
        event.preventDefault();
        handleRunRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning]);

  const handleLoadTemplate = useCallback(
    (templateId: FlowTemplateId) => {
      loadTemplate(templateId);
      toast({
        title: 'Template geladen',
        description: FLOW_TEMPLATES.find((t) => t.id === templateId)?.name ?? templateId,
      });
    },
    [loadTemplate, toast],
  );

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

  const handleOpenSaveDialog = useCallback(() => {
    setIsSaveDialogOpen(true);
  }, []);

  const handleSaveComplete = useCallback(
    (template: SavedFlowTemplate) => {
      setSavedTemplates(
        savedTemplates.some((t) => t.id === template.id)
          ? savedTemplates.map((t) => (t.id === template.id ? template : t))
          : [...savedTemplates, template],
      );
      setActiveTemplate(template.id, template.name);
      toast({ title: 'Template gespeichert', description: `"${template.name}" wurde gesichert.` });
    },
    [savedTemplates, setSavedTemplates, setActiveTemplate, toast],
  );

  const handleLoadSavedTemplate = useCallback(
    (template: SavedFlowTemplate) => {
      loadSavedTemplate(template);
      toast({ title: 'Template geladen', description: template.name });
    },
    [loadSavedTemplate, toast],
  );

  const handleDeleteTemplate = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteTemplateFromDb(deleteTarget.id);
    setSavedTemplates(savedTemplates.filter((t) => t.id !== deleteTarget.id));
    if (activeTemplateId === deleteTarget.id) {
      setActiveTemplate(null, null);
    }
    toast({ title: 'Template gelöscht', description: `"${deleteTarget.name}" wurde entfernt.` });
  }, [deleteTarget, savedTemplates, activeTemplateId, setSavedTemplates, setActiveTemplate, toast]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJson = useCallback(() => {
    const json = exportWorkflowAsJson(workflow.graph);
    const filename = `${workflow.name.replace(/\s+/g, '_')}.json`;
    downloadAsFile(json, filename, 'application/json');
    toast({ title: 'Exportiert', description: `Flow als ${filename} exportiert.` });
  }, [workflow.graph, workflow.name, toast]);

  const handleExportYaml = useCallback(() => {
    const yamlStr = exportWorkflowAsYaml(workflow.graph);
    const filename = `${workflow.name.replace(/\s+/g, '_')}.yaml`;
    downloadAsFile(yamlStr, filename, 'application/x-yaml');
    toast({ title: 'Exportiert', description: `Flow als ${filename} exportiert.` });
  }, [workflow.graph, workflow.name, toast]);

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const content = await readFileAsText(file);
        const ext = getFileExtension(file.name);
        const result =
          ext === 'yaml' || ext === 'yml'
            ? importWorkflowFromYaml(content)
            : importWorkflowFromJson(content);

        if (!result.valid || !result.workflow) {
          toast({
            title: 'Import fehlgeschlagen',
            description: result.errors.join(', '),
            variant: 'destructive',
          });
          return;
        }

        if (result.warnings.length > 0) {
          toast({
            title: 'Import-Warnung',
            description: result.warnings.join(', '),
          });
        }

        const now = new Date().toISOString();
        loadWorkflow({
          id: 'current',
          name: result.workflow.metadata.name,
          description: result.workflow.metadata.description,
          graph: result.workflow,
          runs: [],
          createdAt: now,
          updatedAt: now,
          tags: [],
          isFavorite: false,
        });

        toast({
          title: 'Flow importiert',
          description: `"${result.workflow.metadata.name}" wurde geladen.`,
        });
      } catch {
        toast({
          title: 'Import fehlgeschlagen',
          description: 'Die Datei konnte nicht gelesen werden.',
          variant: 'destructive',
        });
      }

      // Reset file input
      event.target.value = '';
    },
    [loadWorkflow, toast],
  );

  // Keep refs in sync for keyboard shortcuts
  handleSaveRef.current = handleOpenSaveDialog;

  const handleClearLogs = useCallback(() => {
    logEntriesRef.current = [];
    setLogEntries([]);
  }, []);

  const handleClearStatus = useCallback(() => {
    setCompileWarnings([]);
    setRunError(null);
    setShowLastRunInfo(false);
  }, [setRunError]);

  const handleCancelRun = useCallback(() => {
    if (!runAbortControllerRef.current) {
      return;
    }

    runAbortControllerRef.current.abort();
  }, []);

  const handleRun = useCallback(async () => {
    setCompileWarnings([]);
    setRunError(null);
    resetNodeRuntime();
    streamBufferRef.current = '';
    timelineEventsRef.current = [];
    setTimelineData(null);
    logEntriesRef.current = [];
    setLogEntries([]);
    setActiveBottomTab('logger');

    let compiled;
    try {
      compiled = compileVisualWorkflowToPlan(workflow.graph);
      setCompileWarnings(compiled.warnings);
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
          timelineEventsRef.current.push({
            stepId: event.stepId,
            label: event.description,
            type: 'start',
            timestampMs: Date.now(),
          });
          break;

        case 'step_end':
          setNodeRuntime(event.stepId, {
            status: event.status === 'success' ? 'success' : 'error',
            message: event.status === 'failed' ? 'Step ist fehlgeschlagen.' : undefined,
          });
          setRunNodeStatus(event.stepId, event.status === 'success' ? 'success' : 'error');
          totalSteps = Math.max(totalSteps ?? 0, event.stepIndex + 1);
          timelineEventsRef.current.push({
            stepId: event.stepId,
            label: '',
            type: 'end',
            timestampMs: Date.now(),
            status: event.status === 'success' ? 'success' : 'error',
          });
          setTimelineData(buildTimelineFromEvents(timelineEventsRef.current));
          break;

        case 'message':
          streamBufferRef.current += event.content;
          if (compiled.outputNodeId) {
            setNodeRuntime(compiled.outputNodeId, { status: 'running' });
          }
          setOutputResult(streamBufferRef.current);
          setRunNodeStatus(compiled.outputNodeId ?? undefined, 'running');
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
          if (compiled.outputNodeId) {
            setNodeRuntime(compiled.outputNodeId, { status: 'error', message: event.message });
            setRunNodeStatus(compiled.outputNodeId, 'error');
          }
          break;

        case 'cancelled':
          finalStatus = 'cancelled';
          lastError = 'Run wurde abgebrochen.';
          setRunError(lastError);
          break;

        case 'workflow_end':
          finalStatus = event.status;
          durationMs = event.durationMs;
          totalSteps = event.totalSteps;
          completedAt = new Date().toISOString();
          if (event.status === 'done') {
            if (compiled.outputNodeId) {
              setNodeRuntime(compiled.outputNodeId, { status: 'success' });
            }
            setRunNodeStatus(compiled.outputNodeId ?? undefined, 'success');
          } else if (event.status === 'error') {
            if (compiled.outputNodeId) {
              setNodeRuntime(compiled.outputNodeId, {
                status: 'error',
                message: lastError ?? 'Workflow endete mit Fehler.',
              });
            }
            setRunNodeStatus(compiled.outputNodeId ?? undefined, 'error');
          }
          break;

        case 'condition_eval':
          setNodeRuntime(event.stepId, {
            status: 'success',
            message: `Ergebnis: ${event.result}`,
          });
          setRunNodeStatus(event.stepId, 'success');
          break;

        case 'step_skipped':
          setNodeRuntime(event.stepId, {
            status: 'idle',
            message: event.reason,
          });
          setRunNodeStatus(event.stepId, 'idle');
          break;

        case 'loop_iteration':
          setNodeRuntime(event.loopStepId, {
            status: 'running',
            message: `Iteration ${event.iteration + 1}/${event.maxIterations}`,
          });
          break;

        case 'log': {
          const logEvent = event as WorkflowLogEvent;
          const entry: LogEntry = {
            level: logEvent.level,
            message: logEvent.message,
            timestamp: logEvent.timestamp,
            stepId: logEvent.stepId,
            durationMs: logEvent.durationMs,
          };
          logEntriesRef.current = [...logEntriesRef.current, entry];
          setLogEntries(logEntriesRef.current);
          break;
        }
      }
    };

    const abortController = new AbortController();
    runAbortControllerRef.current = abortController;
    setRunning(true);
    try {
      const response = await fetch('/api/chat/agent/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: compiled.entryMessage,
          model: compiled.model,
          provider: compiled.provider,
          systemPrompt: compiled.systemPrompt,
          enabledTools: compiled.enabledTools,
          maxSteps: compiled.plan.steps.length,
          enablePlanning: false,
          enableReflection: true,
          conversationHistory: [],
          initialPlan: compiled.plan,
        }),
        signal: abortController.signal,
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
      const wasAborted =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError');

      if (wasAborted) {
        finalStatus = 'cancelled';
        lastError = 'Run wurde abgebrochen.';
        setRunError(lastError);
        toast({
          title: 'Run abgebrochen',
          description: 'Die laufende Ausführung wurde gestoppt.',
        });
      } else {
        const message = error instanceof Error ? error.message : 'Workflow-Ausführung fehlgeschlagen.';
        lastError = message;
        finalStatus = 'error';
        setRunError(message);
        if (compiled.outputNodeId) {
          setNodeRuntime(compiled.outputNodeId, { status: 'error', message });
          setRunNodeStatus(compiled.outputNodeId, 'error');
        }
        toast({
          title: 'Run fehlgeschlagen',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      runAbortControllerRef.current = null;
      if (finalStatus === 'cancelled') {
        clearRunningNodeRuntime();
      }
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

      if (finalStatus === 'done' && compiled.outputNodeId) {
        const outputNode = workflow.graph.nodes.find((n) => n.id === compiled.outputNodeId);
        if (outputNode?.data.kind === 'output') {
          const outputConfig = (outputNode.data as OutputNodeData).config;
          if (outputConfig.saveToFile) {
            const saveResult = await saveFlowOutput(streamBufferRef.current, outputConfig.filePath);
            if (saveResult.success) {
              toast({
                title: 'Auto-Save erfolgreich',
                description: `Ergebnis wurde in ${saveResult.savedPath} gespeichert.`,
              });
            } else {
              toast({
                title: 'Auto-Save fehlgeschlagen',
                description: saveResult.error,
                variant: 'destructive',
              });
            }
          }
        }
      }
    }
  }, [
    addRunSummary,
    clearRunningNodeRuntime,
    resetNodeRuntime,
    setNodeRuntime,
    setOutputResult,
    setRunError,
    setRunning,
    toast,
    workflow.graph,
  ]);

  handleRunRef.current = handleRun;

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
            {activeTemplateName ?? 'Unnamed Flow'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={isRunning}
              >
                <Plus className="h-3.5 w-3.5" />
                New Flow
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Built-in Templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {FLOW_TEMPLATES.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => handleLoadTemplate(template.id)}
                >
                  <div>
                    <div className="text-sm font-medium">
                      {template.id === 'pdf-processing' && <FileText className="mr-1.5 inline h-3.5 w-3.5 text-cyan-300" />}
                      {template.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{template.description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
              {savedTemplates.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Saved Templates</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {savedTemplates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      className="group flex items-center justify-between"
                      onClick={() => handleLoadSavedTemplate(template)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{template.name}</div>
                        {template.description && (
                          <div className="truncate text-xs text-muted-foreground">{template.description}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="ml-2 hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-400 group-hover:inline-flex"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(template);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={isRunning}
              >
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportJson}>
                Als JSON exportieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportYaml}>
                Als YAML exportieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRunning}
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.yaml,.yml"
            className="hidden"
            onChange={handleImportFile}
          />

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleOpenSaveDialog}
            disabled={isRunning}
          >
            <Save className="h-3.5 w-3.5" />
            Save
            <kbd className="ml-1 hidden text-[10px] opacity-50 sm:inline">⌘S</kbd>
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {isRunning ? 'Running...' : 'Run'}
            {!isRunning && <kbd className="ml-1 hidden text-[10px] opacity-50 sm:inline">⌘↵</kbd>}
          </Button>

          {isRunning && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleCancelRun}
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {(compileWarnings.length > 0 || runError || (showLastRunInfo && lastRun) || isRunning) && (
        <div className="border-b border-border/60 bg-background/70 px-4 py-2 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {isRunning && (
                <div className="mb-1 text-cyan-300">
                  Now running:{' '}
                  {runningNodeLabels.length > 0 ? runningNodeLabels.join(' | ') : 'Workflow wird gestartet...'}
                </div>
              )}
              {compileWarnings.length > 0 && (
                <div className="mb-1 text-amber-300">
                  Warnings: {compileWarnings.join(' | ')}
                </div>
              )}
              {runError && <div className="mb-1 text-red-300">Run Error: {runError}</div>}
              {showLastRunInfo && lastRun && (
                <div className="text-muted-foreground">
                  Last run: {lastRun.status} | {lastRun.durationMs ?? 0} ms | {lastRun.startedAt}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={handleClearStatus}
              disabled={isRunning}
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          </div>
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

        <section className="border-t border-border/60">
          <Tabs value={activeBottomTab} onValueChange={setActiveBottomTab} className="gap-0">
            <TabsList className="h-8 w-full justify-start rounded-none bg-zinc-900/40 px-2">
              <TabsTrigger value="logger" className="h-6 rounded px-2.5 text-[11px] data-[state=active]:bg-muted/60">
                Logger
                {logEntries.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-cyan-500/20 px-1.5 text-[10px] text-cyan-300">
                    {logEntries.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="timeline" className="h-6 rounded px-2.5 text-[11px] data-[state=active]:bg-muted/60">
                Timeline
              </TabsTrigger>
              <TabsTrigger value="history" className="h-6 rounded px-2.5 text-[11px] data-[state=active]:bg-muted/60">
                Run History
                {workflow.runs.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    ({workflow.runs.length})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="logger" className="mt-0">
              <LoggerPanel logs={logEntries} onClear={handleClearLogs} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-0">
              {timelineData && timelineData.entries.length > 0 ? (
                <StepTimeline data={timelineData} />
              ) : (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Keine Timeline-Daten vorhanden. Starte einen Workflow.
                </div>
              )}
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <RunHistoryPanel
                runs={workflow.runs}
                selectedRunId={selectedRunId}
                onSelectRun={handleSelectRun}
              />
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <NodeCommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        onSelectKind={handleInsertNodeFromCommand}
      />

      <SaveFlowDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSaveComplete={handleSaveComplete}
      />

      <DeleteTemplateDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        templateName={deleteTarget?.name ?? ''}
        onConfirm={handleDeleteTemplate}
      />
    </div>
  );
}
