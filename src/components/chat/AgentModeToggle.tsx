"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  { name: 'create_note', label: 'Notiz erstellen', emoji: '📝' },
  { name: 'save_memory', label: 'Merken', emoji: '🧠' },
  { name: 'recall_memory', label: 'Erinnern', emoji: '💭' },
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
}

export function AgentModeToggle({
  isActive,
  onToggle,
  enabledTools,
  onToggleTool,
  disabled = false,
}: AgentModeToggleProps) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
        size="icon"
        disabled={disabled}
        onClick={onToggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowPopover(prev => !prev);
        }}
        className={cn(
          'h-8 w-8 relative transition-all duration-300',
          isActive
            ? 'text-primary bg-primary/15 hover:bg-primary/25 shadow-[0_0_12px_rgba(var(--primary-rgb,59,130,246),0.3)]'
            : 'text-muted-foreground hover:text-foreground',
        )}
        title={
          isActive
            ? `Agent Modus aktiv (${enabledTools.length} Werkzeuge) — Rechtsklick für Werkzeuge`
            : 'Agent Modus — KI kann Werkzeuge nutzen'
        }
      >
        <Zap className={cn('h-4 w-4', isActive && 'fill-primary')} />
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </span>
        )}
      </Button>

      {/* Tool badges (when active, show inline next to button) */}
      {isActive && (
        <button
          type="button"
          onClick={() => setShowPopover(prev => !prev)}
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-0.5 cursor-pointer"
          title="Werkzeuge konfigurieren"
        >
          {enabledTools.slice(0, 4).map(toolName => {
            const tool = AVAILABLE_TOOLS.find(t => t.name === toolName);
            return (
              <span
                key={toolName}
                className="text-[10px] leading-none"
              >
                {tool?.emoji || '🔧'}
              </span>
            );
          })}
          {enabledTools.length > 4 && (
            <span className="text-[9px] text-muted-foreground">+{enabledTools.length - 4}</span>
          )}
        </button>
      )}

      {/* Popover: Tool list */}
      {showPopover && (
        <div
          ref={popoverRef}
          className={cn(
            'absolute bottom-full mb-2 right-0 z-50',
            'min-w-[220px] rounded-lg border border-border/60',
            'bg-popover/95 backdrop-blur-md shadow-xl',
            'p-2 space-y-0.5',
          )}
        >
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
