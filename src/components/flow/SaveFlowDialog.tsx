"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useFlowStore } from '@/stores/flowStore';
import { saveTemplate } from '@/lib/flow/serialization';
import type { SavedFlowTemplate, FlowNode, VisualWorkflow } from '@/lib/flow/types';

interface SaveFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveComplete: (template: SavedFlowTemplate) => void;
}

function stripRuntimeFromGraph(graph: VisualWorkflow): VisualWorkflow {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        runtime: { status: 'idle' as const },
        config:
          node.data.kind === 'output'
            ? { ...node.data.config, result: '' }
            : node.data.config,
      },
    })) as FlowNode[],
  };
}

export function SaveFlowDialog({ open, onOpenChange, onSaveComplete }: SaveFlowDialogProps) {
  const workflow = useFlowStore((state) => state.workflow);
  const activeTemplateId = useFlowStore((state) => state.activeTemplateId);
  const activeTemplateName = useFlowStore((state) => state.activeTemplateName);

  const [name, setName] = useState('');
  const [mode, setMode] = useState<'new' | 'overwrite'>('new');
  const [saving, setSaving] = useState(false);

  const hasActiveTemplate = activeTemplateId !== null;

  useEffect(() => {
    if (open) {
      setMode(hasActiveTemplate ? 'overwrite' : 'new');
      setName(hasActiveTemplate ? '' : (workflow.graph.metadata.name || ''));
      setSaving(false);
    }
  }, [open, hasActiveTemplate, workflow.graph.metadata.name]);

  const handleSave = useCallback(async () => {
    const isOverwrite = mode === 'overwrite' && activeTemplateId;
    const templateName = isOverwrite ? activeTemplateName! : name.trim();

    if (!templateName) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const template: SavedFlowTemplate = {
        id: isOverwrite ? activeTemplateId : crypto.randomUUID(),
        name: templateName,
        description: workflow.graph.metadata.description,
        graph: stripRuntimeFromGraph(workflow.graph),
        createdAt: isOverwrite ? now : now,
        updatedAt: now,
      };

      await saveTemplate(template);
      onSaveComplete(template);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [mode, activeTemplateId, activeTemplateName, name, workflow.graph, onSaveComplete, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-4 w-4 text-cyan-400" />
            Flow-Template speichern
          </DialogTitle>
          <DialogDescription>
            {hasActiveTemplate
              ? `Du bearbeitest "${activeTemplateName}". Überschreiben oder als neues Template speichern?`
              : 'Speichere den aktuellen Flow als wiederverwendbares Template.'}
          </DialogDescription>
        </DialogHeader>

        {hasActiveTemplate && (
          <div className="flex gap-2">
            <Button
              variant={mode === 'overwrite' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('overwrite')}
            >
              Überschreiben
            </Button>
            <Button
              variant={mode === 'new' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('new')}
            >
              Neues Template
            </Button>
          </div>
        )}

        {mode === 'new' && (
          <div className="space-y-2">
            <label htmlFor="template-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="template-name"
              placeholder="Mein Flow-Template"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleSave();
                }
              }}
              autoFocus
            />
          </div>
        )}

        {mode === 'overwrite' && (
          <p className="text-sm text-muted-foreground">
            Das Template <span className="font-medium text-foreground">&quot;{activeTemplateName}&quot;</span> wird mit dem aktuellen Flow-Stand überschrieben.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (mode === 'new' && !name.trim())}
          >
            {saving ? 'Speichern...' : mode === 'overwrite' ? 'Überschreiben' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
