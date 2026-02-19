"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getOllamaModels } from '@/lib/ollama';
import type { AgentNodeData, InputNodeData, OutputNodeData, TemplateNodeData } from '@/lib/flow/types';
import { cn } from '@/lib/utils';
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
  const nodes = useFlowStore((state) => state.workflow.graph.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const updateNodeLabel = useFlowStore((state) => state.updateNodeLabel);
  const updateNodeConfig = useFlowStore((state) => state.updateNodeConfig);
  const removeNode = useFlowStore((state) => state.removeNode);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const inputData = selectedNode?.data.kind === 'input' ? (selectedNode.data as InputNodeData) : null;
  const agentData = selectedNode?.data.kind === 'agent' ? (selectedNode.data as AgentNodeData) : null;
  const templateData =
    selectedNode?.data.kind === 'template' ? (selectedNode.data as TemplateNodeData) : null;
  const outputData = selectedNode?.data.kind === 'output' ? (selectedNode.data as OutputNodeData) : null;

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      const models = await getOllamaModels();
      if (cancelled) {
        return;
      }

      const uniqueModels = Array.from(
        new Set(
          models
            .map((model) => model.name?.trim())
            .filter((modelName): modelName is string => Boolean(modelName)),
        ),
      ).sort((left, right) => left.localeCompare(right));

      setAvailableModels(uniqueModels);
    };

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  const agentModelOptions = useMemo(() => {
    const options = new Set<string>();
    const currentModel = agentData?.config.model?.trim();

    if (currentModel) {
      options.add(currentModel);
    }

    for (const modelName of availableModels) {
      options.add(modelName);
    }

    for (const modelName of FALLBACK_AGENT_MODELS) {
      options.add(modelName);
    }

    return Array.from(options);
  }, [agentData?.config.model, availableModels]);

  if (!selectedNode) {
    return (
      <aside className="h-full w-[360px] border-l border-border/60 bg-zinc-900/70 p-4">
        <h2 className="text-sm font-semibold tracking-wide">Config</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Wähle einen Node im Canvas aus, um Konfigurationen zu bearbeiten.
        </p>
      </aside>
    );
  }

  return (
    <aside className="h-full w-[360px] border-l border-border/60 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold tracking-wide">Config</h2>

      <div className="mt-4 space-y-4">
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
            <div className="space-y-2">
              <SectionTitle>Model</SectionTitle>
              <select
                value={agentData.config.model}
                onChange={(event) => updateNodeConfig(selectedNode.id, { model: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {agentModelOptions.map((modelName) => (
                  <option key={modelName} value={modelName}>
                    {modelName}
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
          <div className="space-y-2">
            <SectionTitle>Result Preview</SectionTitle>
            <Textarea
              readOnly
              value={outputData.config.result ?? ''}
              className="min-h-[220px] text-xs"
              placeholder="Noch kein Ergebnis."
            />
          </div>
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
