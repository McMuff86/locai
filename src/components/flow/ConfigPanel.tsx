"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

export function ConfigPanel() {
  const nodes = useFlowStore((state) => state.workflow.graph.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const updateNodeLabel = useFlowStore((state) => state.updateNodeLabel);
  const updateNodeConfig = useFlowStore((state) => state.updateNodeConfig);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const inputData = selectedNode?.data.kind === 'input' ? (selectedNode.data as InputNodeData) : null;
  const agentData = selectedNode?.data.kind === 'agent' ? (selectedNode.data as AgentNodeData) : null;
  const templateData =
    selectedNode?.data.kind === 'template' ? (selectedNode.data as TemplateNodeData) : null;
  const outputData = selectedNode?.data.kind === 'output' ? (selectedNode.data as OutputNodeData) : null;

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
              <Input
                value={agentData.config.model}
                onChange={(event) => updateNodeConfig(selectedNode.id, { model: event.target.value })}
                className="h-9 text-xs"
              />
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
      </div>
    </aside>
  );
}

export default ConfigPanel;
