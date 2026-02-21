"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ProviderType, ModelInfo } from '@/lib/providers/types';
import type { AgentNodeData, InputNodeData, OutputNodeData, TemplateNodeData } from '@/lib/flow/types';
import { saveFlowOutput } from '@/lib/flow/saveOutput';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useFlowStore } from '@/stores/flowStore';

const BUILTIN_TOOLS = [
  'search_documents',
  'web_search',
  'read_file',
  'write_file',
  'edit_file',
  'create_note',
  'save_memory',
  'recall_memory',
  'run_command',
  'run_code',
  'generate_image',
];

const FALLBACK_AGENT_MODELS = [
  'llama3',
  'llama3.2',
  'qwen2.5-coder',
  'mistral',
  'gemma3',
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

export function ConfigPanel() {
  const { toast } = useToast();
  const nodes = useFlowStore((state) => state.workflow.graph.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const updateNodeLabel = useFlowStore((state) => state.updateNodeLabel);
  const updateNodeConfig = useFlowStore((state) => state.updateNodeConfig);
  const removeNode = useFlowStore((state) => state.removeNode);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, ModelInfo[]>>({});
  const [activeProviders, setActiveProviders] = useState<ProviderType[]>(['ollama']);
  const [isSaving, setIsSaving] = useState(false);
  const [panelWidth, setPanelWidth] = useState(360);
  const isResizingRef = useRef(false);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const inputData = selectedNode?.data.kind === 'input' ? (selectedNode.data as InputNodeData) : null;
  const agentData = selectedNode?.data.kind === 'agent' ? (selectedNode.data as AgentNodeData) : null;
  const templateData =
    selectedNode?.data.kind === 'template' ? (selectedNode.data as TemplateNodeData) : null;
  const outputData = selectedNode?.data.kind === 'output' ? (selectedNode.data as OutputNodeData) : null;

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        const res = await fetch('/api/models');
        if (!res.ok) throw new Error('Failed to fetch models');
        const data = await res.json();
        if (cancelled) return;

        const providers: ProviderType[] = data.providers ?? ['ollama'];
        setActiveProviders(providers);
        setModelsByProvider(data.byProvider ?? {});
      } catch {
        if (!cancelled) {
          setActiveProviders(['ollama']);
          setModelsByProvider({});
        }
      }
    };

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  const agentModelOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { id: string; name: string }[] = [];
    const currentModel = agentData?.config.model?.trim();
    const provider = agentData?.config.provider ?? 'ollama';

    const add = (id: string, name: string) => {
      if (!seen.has(id)) {
        seen.add(id);
        options.push({ id, name });
      }
    };

    if (currentModel) {
      add(currentModel, currentModel);
    }

    const serverModels = modelsByProvider[provider];
    if (serverModels && serverModels.length > 0) {
      for (const m of serverModels) {
        add(m.id, m.name);
      }
    } else if (provider === 'ollama') {
      for (const modelName of FALLBACK_AGENT_MODELS) {
        add(modelName, modelName);
      }
    }

    return options;
  }, [agentData?.config.model, agentData?.config.provider, modelsByProvider]);

  const handleResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isResizingRef.current) return;
      const delta = startX - moveEvent.clientX;
      setPanelWidth(Math.max(260, Math.min(700, startWidth + delta)));
    };

    const onPointerUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, [panelWidth]);

  const handleSaveToWorkspace = useCallback(async () => {
    if (!outputData?.config.result) {
      return;
    }

    setIsSaving(true);
    const result = await saveFlowOutput(outputData.config.result, outputData.config.filePath);
    setIsSaving(false);

    if (result.success) {
      toast({
        title: 'Gespeichert',
        description: `Ergebnis wurde in ${result.savedPath} gespeichert.`,
      });
    } else {
      toast({
        title: 'Speichern fehlgeschlagen',
        description: result.error,
        variant: 'destructive',
      });
    }
  }, [outputData?.config.result, outputData?.config.filePath, toast]);

  const resizeHandle = (
    <div
      onPointerDown={handleResizeStart}
      className="absolute left-0 top-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-border/30"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/40" />
    </div>
  );

  if (!selectedNode) {
    return (
      <aside className="relative h-full border-l border-border/60 bg-zinc-900/70 p-4 pl-5" style={{ width: panelWidth }}>
        {resizeHandle}
        <h2 className="text-sm font-semibold tracking-wide">Config</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Wähle einen Node im Canvas aus, um Konfigurationen zu bearbeiten.
        </p>
      </aside>
    );
  }

  return (
    <aside className="relative flex h-full flex-col border-l border-border/60 bg-zinc-900/70 p-4 pl-5" style={{ width: panelWidth }}>
      {resizeHandle}
      <h2 className="shrink-0 text-sm font-semibold tracking-wide">Config</h2>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2">
          <SectionTitle>Label</SectionTitle>
          <Input
            value={selectedNode.data.label}
            onChange={(event) => updateNodeLabel(selectedNode.id, event.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {inputData && (
          <>
            <div className="space-y-2">
              <SectionTitle>Input Text</SectionTitle>
              <Textarea
                value={inputData.config.text}
                onChange={(event) => updateNodeConfig(selectedNode.id, { text: event.target.value })}
                className="min-h-[140px] text-xs"
              />
            </div>

            <div className="space-y-2">
              <SectionTitle>Success Criteria</SectionTitle>
              <Input
                value={inputData.config.successCriteria ?? ''}
                onChange={(event) =>
                  updateNodeConfig(selectedNode.id, { successCriteria: event.target.value })
                }
                className="h-9 text-xs"
              />
            </div>
          </>
        )}

        {agentData && (
          <>
            {activeProviders.length > 1 && (
              <div className="space-y-2">
                <SectionTitle>Provider</SectionTitle>
                <select
                  value={agentData.config.provider ?? 'ollama'}
                  onChange={(event) =>
                    updateNodeConfig(selectedNode.id, {
                      provider: event.target.value as ProviderType,
                      model: '', // reset model when switching provider
                    })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {activeProviders.map((p) => (
                    <option key={p} value={p}>
                      {p === 'ollama' ? '🦙 Ollama (Local)' : p === 'anthropic' ? '🧠 Anthropic (Claude)' : p === 'openai' ? '💚 OpenAI' : '🔀 OpenRouter'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <SectionTitle>Model</SectionTitle>
              <select
                value={agentData.config.model}
                onChange={(event) => updateNodeConfig(selectedNode.id, { model: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {agentModelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <SectionTitle>Prompt</SectionTitle>
              <Textarea
                value={agentData.config.prompt}
                onChange={(event) => updateNodeConfig(selectedNode.id, { prompt: event.target.value })}
                className="min-h-[120px] text-xs"
              />
            </div>

            <div className="space-y-2">
              <SectionTitle>System Prompt</SectionTitle>
              <Textarea
                value={agentData.config.systemPrompt ?? ''}
                onChange={(event) =>
                  updateNodeConfig(selectedNode.id, { systemPrompt: event.target.value })
                }
                className="min-h-[100px] text-xs"
              />
            </div>

            <div className="space-y-2">
              <SectionTitle>Success Criteria</SectionTitle>
              <Input
                value={agentData.config.successCriteria ?? ''}
                onChange={(event) =>
                  updateNodeConfig(selectedNode.id, { successCriteria: event.target.value })
                }
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-2">
              <SectionTitle>Tools</SectionTitle>
              <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border/60 bg-card/30 p-2">
                {BUILTIN_TOOLS.map((tool) => {
                  const active = agentData.config.tools.includes(tool);
                  return (
                    <label
                      key={tool}
                      className={cn(
                        'flex items-center gap-2 rounded px-1.5 py-1 text-[11px] transition-colors',
                        active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={active}
                        onChange={(event) => {
                          const currentTools = agentData.config.tools;
                          const nextTools = event.target.checked
                            ? [...new Set([...currentTools, tool])]
                            : currentTools.filter((value: string) => value !== tool);
                          updateNodeConfig(selectedNode.id, { tools: nextTools });
                        }}
                      />
                      <span className="truncate">{tool}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {templateData && (
          <>
            <div className="space-y-2">
              <SectionTitle>Template</SectionTitle>
              <Textarea
                value={templateData.config.template}
                onChange={(event) => updateNodeConfig(selectedNode.id, { template: event.target.value })}
                className="min-h-[140px] text-xs"
              />
            </div>

            <div className="space-y-2">
              <SectionTitle>Success Criteria</SectionTitle>
              <Input
                value={templateData.config.successCriteria ?? ''}
                onChange={(event) =>
                  updateNodeConfig(selectedNode.id, { successCriteria: event.target.value })
                }
                className="h-9 text-xs"
              />
            </div>
          </>
        )}

        {outputData && (
          <>
            <div className="space-y-2">
              <SectionTitle>Result Preview</SectionTitle>
              <Textarea
                readOnly
                value={outputData.config.result ?? ''}
                className="min-h-[220px] text-xs"
                placeholder="Noch kein Ergebnis."
              />
            </div>

            <div className="space-y-2">
              <SectionTitle>Im Workspace speichern</SectionTitle>
              <div className="space-y-2 rounded-md border border-border/60 bg-card/30 p-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground">Dateipfad (relativ zum Workspace)</label>
                  <Input
                    value={outputData.config.filePath ?? ''}
                    onChange={(event) =>
                      updateNodeConfig(selectedNode.id, { filePath: event.target.value })
                    }
                    placeholder="z.B. flow-results/output.txt"
                    className="h-8 text-xs"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-center gap-1.5"
                  disabled={!outputData.config.result?.trim() || isSaving}
                  onClick={handleSaveToWorkspace}
                >
                  <Download className="h-3.5 w-3.5" />
                  {isSaving ? 'Speichern...' : 'Im Workspace speichern'}
                </Button>
                {!outputData.config.filePath?.trim() && (
                  <p className="text-[10px] text-muted-foreground/70">
                    Ohne Dateipfad wird automatisch ein Name vergeben (z.B. FlowOutput_20260219_220135.txt)
                  </p>
                )}

                <label className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={outputData.config.saveToFile ?? false}
                    onChange={(event) =>
                      updateNodeConfig(selectedNode.id, { saveToFile: event.target.checked })
                    }
                  />
                  Auto-Save nach erfolgreichem Run
                </label>
              </div>
            </div>
          </>
        )}

        <div className="border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full justify-center gap-1.5"
            onClick={() => removeNode(selectedNode.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Node löschen
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default ConfigPanel;
