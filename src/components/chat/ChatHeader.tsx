"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronDown, Check, Save, FolderOpen, 
  Download, Upload, Trash, Menu, Plus, PanelLeftClose, PanelLeft,
  Activity, Thermometer, Zap, Hash
} from 'lucide-react';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { ConversationSummary } from '../../lib/conversations/types';
import { OllamaModel } from '../../lib/ollama';

// ── Types ──────────────────────────────────────────────────────────

interface GpuQuickStats {
  gpuUtil: number;
  vramUsed: number;
  vramTotal: number;
  temperature: number;
  gpuAvailable: boolean;
  ollamaRunning: boolean;
}

interface TokenStatsCompact {
  totalTokens: number;
  tokensPerSecond: number;
}

interface ChatHeaderProps {
  // Model props
  models: OllamaModel[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  showModelSelector: boolean;
  onPullModel?: () => void;
  
  // Conversation props
  conversationTitle?: string;
  savedConversations: ConversationSummary[];
  onSaveConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onImportConversations: () => void;
  onExportConversations: () => void;
  onClearAllConversations: () => void;
  
  // Sidebar toggle props
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
  isSidebarOpen?: boolean;
  
  // Token stats (optional – passed from parent)
  tokenStats?: TokenStatsCompact | null;
  
  // GPU float toggle
  onToggleGpuFloat?: () => void;
  
  // Mobile props
  isMobile?: boolean;
}

// ── Ollama Status Pill ─────────────────────────────────────────────

function OllamaStatusPill({ 
  isConnected, 
  modelName 
}: { 
  isConnected: boolean; 
  modelName: string; 
}) {
  // Truncate long model names
  const displayName = modelName.length > 24 
    ? modelName.slice(0, 22) + '…' 
    : modelName;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/60 text-xs font-medium select-none">
      <div
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          isConnected ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,.6)]" : "bg-red-500"
        )}
      />
      <span className="truncate text-muted-foreground">{displayName}</span>
    </div>
  );
}

// ── Token Badge ────────────────────────────────────────────────────

function TokenBadge({ stats }: { stats: TokenStatsCompact }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/60 text-xs font-medium text-muted-foreground select-none">
      <Hash className="h-3 w-3" />
      <span className="tabular-nums">{stats.totalTokens.toLocaleString()}</span>
      {stats.tokensPerSecond > 0 && (
        <>
          <span className="text-border">|</span>
          <Zap className="h-3 w-3 text-amber-500" />
          <span className="tabular-nums">{stats.tokensPerSecond} t/s</span>
        </>
      )}
    </div>
  );
}

// ── GPU Quick Tooltip ──────────────────────────────────────────────

function GpuQuickButton({ 
  stats, 
  onToggleFloat 
}: { 
  stats: GpuQuickStats | null; 
  onToggleFloat?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const tempColor = (t: number) => {
    if (t >= 85) return 'text-red-500';
    if (t >= 70) return 'text-amber-500';
    return 'text-emerald-500';
  };

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onToggleFloat}
        title="GPU Monitor"
      >
        <Activity className="h-4 w-4" />
      </Button>

      {/* Hover tooltip */}
      {hovered && stats && stats.gpuAvailable && (
        <div className="absolute top-full right-0 mt-1 z-50 w-52 rounded-lg border bg-popover p-3 shadow-md text-xs space-y-1.5 pointer-events-none">
          <div className="flex justify-between">
            <span className="text-muted-foreground">GPU Usage</span>
            <span className="font-medium tabular-nums">{stats.gpuUtil}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">VRAM</span>
            <span className="font-medium tabular-nums">
              {stats.vramUsed.toFixed(1)} / {stats.vramTotal.toFixed(0)} GB
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Temperature</span>
            <span className={cn("font-medium tabular-nums", tempColor(stats.temperature))}>
              {stats.temperature}°C
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function ChatHeader({
  models,
  selectedModel,
  onModelChange,
  showModelSelector,
  onPullModel,
  conversationTitle,
  savedConversations,
  onSaveConversation,
  onSelectConversation,
  onImportConversations,
  onExportConversations,
  onClearAllConversations,
  onToggleSidebar,
  showSidebarToggle = false,
  isSidebarOpen = true,
  tokenStats = null,
  onToggleGpuFloat,
  isMobile = false,
}: ChatHeaderProps) {
  // Lightweight GPU quick-stats (shared fetch with GpuFloatWidget via cache)
  const [gpuStats, setGpuStats] = useState<GpuQuickStats | null>(null);

  const fetchQuickStats = useCallback(async () => {
    try {
      const res = await fetch('/api/system-stats');
      if (!res.ok) return;
      const data = await res.json();
      setGpuStats({
        gpuUtil: data.gpu?.utilization ?? 0,
        vramUsed: data.gpu?.vram?.used ?? 0,
        vramTotal: data.gpu?.vram?.total ?? 0,
        temperature: data.gpu?.temperature ?? 0,
        gpuAvailable: data.gpu?.available ?? false,
        ollamaRunning: data.ollama?.running ?? false,
      });
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchQuickStats();
    const id = setInterval(fetchQuickStats, 5000);
    return () => clearInterval(id);
  }, [fetchQuickStats]);

  const isOllamaConnected = gpuStats?.ollamaRunning ?? false;
  const title = conversationTitle || 'Chat';

  // ── Sub-components ────────────────────────────────────────────

  const ConversationDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={isMobile ? "ghost" : "ghost"} size="icon" className="h-8 w-8">
          <FolderOpen className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Gespeicherte Konversationen</DropdownMenuLabel>
        {savedConversations.length === 0 ? (
          <DropdownMenuItem disabled>Keine gespeicherten Konversationen</DropdownMenuItem>
        ) : (
          savedConversations.map(conv => (
            <DropdownMenuItem
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
            >
              {typeof conv.title === 'string' ? conv.title : 'Bildkonversation'}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onImportConversations}>
          <Upload className="h-4 w-4 mr-2" />
          Importieren
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportConversations}>
          <Download className="h-4 w-4 mr-2" />
          Exportieren
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={onClearAllConversations} 
          className="text-destructive focus:text-destructive"
        >
          <Trash className="h-4 w-4 mr-2" />
          Alle löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const ModelDropdown = () => (
    <DropdownMenu>
      {models.length > 0 && showModelSelector && (
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-1 h-8 px-2 text-xs font-medium">
            {selectedModel}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Modell wechseln</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {models.map((model) => (
          <DropdownMenuItem 
            key={model.name}
            onClick={() => onModelChange(model.name)}
            className="flex items-center justify-between"
          >
            {model.name}
            {model.name === selectedModel && <Check className="h-4 w-4 ml-2" />}
          </DropdownMenuItem>
        ))}
        {onPullModel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPullModel}>
              <Plus className="h-4 w-4 mr-2" />
              Neues Modell
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // ── Mobile Header ─────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex items-center justify-between p-2 border-b md:hidden">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1">
          <OllamaStatusPill isConnected={isOllamaConnected} modelName={selectedModel} />
          <ModelDropdown />
          <GpuQuickButton stats={gpuStats} onToggleFloat={onToggleGpuFloat} />
        </div>
        <ThemeToggle />
      </div>
    );
  }

  // ── Desktop Header ────────────────────────────────────────────
  // Layout: [Sidebar Toggle] [💬 Title] ──── [Status Pill] [Model] [📊] [Tokens] [Save] [Load] [Theme]

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b gap-2 min-h-[48px]">
      {/* Left: sidebar toggle + title */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        {showSidebarToggle && onToggleSidebar && (
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleSidebar}
            title={isSidebarOpen ? "Sidebar ausblenden" : "Sidebar einblenden"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </Button>
        )}
        <span className="text-sm font-semibold truncate max-w-[200px]" title={title}>
          💬 {title}
        </span>
      </div>

      {/* Right: status indicators + actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Ollama status pill */}
        <OllamaStatusPill isConnected={isOllamaConnected} modelName={selectedModel} />

        {/* Model selector */}
        <ModelDropdown />

        {/* GPU quick stats */}
        <GpuQuickButton stats={gpuStats} onToggleFloat={onToggleGpuFloat} />

        {/* Token badge */}
        {tokenStats && tokenStats.totalTokens > 0 && (
          <TokenBadge stats={tokenStats} />
        )}

        {/* Save */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onSaveConversation}
          title="Speichern"
        >
          <Save className="h-4 w-4" />
        </Button>

        {/* Load conversations */}
        <ConversationDropdown />

        {/* Theme */}
        <ThemeToggle />
      </div>
    </div>
  );
}

export default ChatHeader;
