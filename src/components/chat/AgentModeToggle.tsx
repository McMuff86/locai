"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Zap, Check, AlertTriangle, Lightbulb, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getModelAgentCapability } from '@/lib/agents/modelCapabilities';
import { AGENT_PRESETS, type AgentPreset } from '@/lib/agents/presets';

// ---------------------------------------------------------------------------
// Tool metadata for the UI
// ---------------------------------------------------------------------------

interface ToolInfo {
  name: string;
  label: string;
  emoji: string;
}

const AVAILABLE_TOOLS: ToolInfo[] = [
  { name: 'search_documents', label: 'Suche Dokumente', emoji: '📄' },
  { name: 'web_search', label: 'Web-Suche', emoji: '🌐' },
  { name: 'read_file', label: 'Datei lesen', emoji: '📖' },
  { name: 'write_file', label: 'Datei schreiben', emoji: '✏️' },
  { name: 'edit_file', label: 'Datei bearbeiten', emoji: '🔧' },
  { name: 'create_note', label: 'Notiz erstellen', emoji: '📝' },
  { name: 'save_memory', label: 'Merken', emoji: '🧠' },
  { name: 'recall_memory', label: 'Erinnern', emoji: '💭' },
  { name: 'run_command', label: 'Befehl ausführen', emoji: '⚡' },
  { name: 'run_code', label: 'Code ausführen', emoji: '▶️' },
  { name: 'generate_image', label: 'Bild generieren', emoji: '🎨' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentModeToggleProps {
  isActive: boolean;
  onToggle: () => void;
  enabledTools: string[];
  onToggleTool: (toolName: string) => void;
  disabled?: boolean;
  modelName?: string;
  activePreset?: string | null;
  onSelectPreset?: (preset: AgentPreset | null) => void;
  enablePlanning?: boolean;
  onTogglePlanning?: () => void;
  /** Workflow Engine mode (Sprint 5) */
  workflowMode?: boolean;
  onToggleWorkflowMode?: () => void;
  /** Reflection toggle (Workflow mode only) */
  enableReflection?: boolean;
  onToggleReflection?: () => void;
}

export function AgentModeToggle({
  isActive,
  onToggle,
  enabledTools,
  onToggleTool,
  disabled = false,
  modelName,
  activePreset,
  onSelectPreset,
  enablePlanning = false,
  onTogglePlanning,
  workflowMode = false,
  onToggleWorkflowMode,
  enableReflection = true,
  onToggleReflection,
}: AgentModeToggleProps) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Model capability check
  const capability = modelName ? getModelAgentCapability(modelName) : null;
  const showWarning = capability && (capability.tier === 'none' || capability.tier === 'basic');

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  return (
    <div className="relative">
      {/* Main toggle button */}
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={onToggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowPopover(prev => !prev);
        }}
        className={cn(
          'h-12 w-12 relative transition-all duration-300',
          isActive
            ? 'text-primary bg-primary/15 hover:bg-primary/25 shadow-[0_0_16px_rgba(var(--primary-rgb,59,130,246),0.35)]'
            : 'text-muted-foreground hover:text-foreground',
        )}
        title={
          isActive
            ? `Agent Modus aktiv (${enabledTools.length} Werkzeuge) — Rechtsklick für Werkzeuge`
            : 'Agent Modus — KI kann Werkzeuge nutzen'
        }
      >
        <Zap className={cn('h-6 w-6', isActive && 'fill-primary')} />
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
          </span>
        )}
      </Button>

      {/* Tool badges (when active, show inline next to button) */}
      {isActive && (
        <button
          type="button"
          onClick={() => setShowPopover(prev => !prev)}
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-0.5 cursor-pointer"
          title="Werkzeuge konfigurieren"
        >
          {enabledTools.slice(0, 4).map(toolName => {
            const tool = AVAILABLE_TOOLS.find(t => t.name === toolName);
            return (
              <span
                key={toolName}
                className="text-xs leading-none"
              >
                {tool?.emoji || '🔧'}
              </span>
            );
          })}
          {enabledTools.length > 4 && (
            <span className="text-[11px] text-muted-foreground">+{enabledTools.length - 4}</span>
          )}
        </button>
      )}

      {/* Popover: Presets + Tool list + Planning */}
      {showPopover && (
        <div
          ref={popoverRef}
          className={cn(
            'absolute bottom-full mb-2 right-0 z-50',
            'min-w-[260px] max-w-[320px] rounded-lg border border-border/60',
            'bg-popover/95 backdrop-blur-md shadow-xl',
            'p-2 space-y-1',
          )}
        >
          {/* Model warning */}
          {showWarning && isActive && (
            <div className={cn(
              'flex items-start gap-2 px-2 py-2 rounded-md text-xs mb-1',
              capability.tier === 'none'
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
            )}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{capability.label}</p>
                <p className="text-[10px] opacity-80 mt-0.5">{capability.description}</p>
                <p className="text-[10px] opacity-60 mt-1">Empfohlen: Qwen 2.5, Llama 3.1+, Hermes</p>
              </div>
            </div>
          )}

          {/* Presets section */}
          {onSelectPreset && (
            <>
              <p className="text-xs font-semibold text-muted-foreground px-2 py-1 select-none flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Presets
              </p>
              {AGENT_PRESETS.map(preset => {
                const isActivePreset = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(isActivePreset ? null : preset)}
                    className={cn(
                      'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors',
                      'hover:bg-muted/60',
                      isActivePreset
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-foreground',
                    )}
                  >
                    <span className="text-base shrink-0">{preset.icon}</span>
                    <div className="flex-1 text-left min-w-0">
                      <span className="block truncate font-medium text-xs">{preset.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{preset.description}</span>
                    </div>
                    {isActivePreset && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
              <div className="border-t border-border/40 my-1" />
            </>
          )}

          {/* Workflow Mode toggle */}
          {onToggleWorkflowMode && (
            <>
              <p className="text-xs font-semibold text-muted-foreground px-2 py-1 select-none flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                Workflow Engine
              </p>
              <button
                type="button"
                onClick={onToggleWorkflowMode}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors',
                  'hover:bg-muted/60',
                  workflowMode ? 'text-foreground bg-primary/5 border border-primary/20' : 'text-muted-foreground',
                )}
              >
                <GitBranch className="h-4 w-4 shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <span className="block truncate font-medium text-xs">Workflow Modus</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    Plan → Execute → Reflect
                  </span>
                </div>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full shrink-0',
                  workflowMode
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {workflowMode ? 'An' : 'Aus'}
                </span>
              </button>

              {/* Reflection toggle (only visible in workflow mode) */}
              {workflowMode && onToggleReflection && (
                <button
                  type="button"
                  onClick={onToggleReflection}
                  className={cn(
                    'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors ml-2',
                    'hover:bg-muted/60',
                    enableReflection ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span className="text-base shrink-0">💡</span>
                  <span className="flex-1 text-left truncate text-xs">Reflection</span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    enableReflection
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {enableReflection ? 'An' : 'Aus'}
                  </span>
                </button>
              )}
              <div className="border-t border-border/40 my-1" />
            </>
          )}

          {/* Planning toggle */}
          {onTogglePlanning && !workflowMode && (
            <>
              <button
                type="button"
                onClick={onTogglePlanning}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors',
                  'hover:bg-muted/60',
                  enablePlanning ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className="text-base shrink-0">📋</span>
                <span className="flex-1 text-left truncate">Planning</span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  enablePlanning
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {enablePlanning ? 'An' : 'Aus'}
                </span>
              </button>
              <div className="border-t border-border/40 my-1" />
            </>
          )}

          {/* Tools section */}
          <p className="text-xs font-semibold text-muted-foreground px-2 py-1 select-none">
            Werkzeuge
          </p>
          {AVAILABLE_TOOLS.map(tool => {
            const isEnabled = enabledTools.includes(tool.name);
            return (
              <button
                key={tool.name}
                type="button"
                onClick={() => onToggleTool(tool.name)}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors',
                  'hover:bg-muted/60',
                  isEnabled ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className="text-base shrink-0">{tool.emoji}</span>
                <span className="flex-1 text-left truncate">{tool.label}</span>
                {isEnabled && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
