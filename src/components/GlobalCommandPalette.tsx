"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Search,
  Files,
  Image,
  Music,
  FileText,
  Terminal,
  Brain,
  Workflow,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

const COMMANDS: CommandItem[] = [
  { id: "flow", label: "Flow", description: "Workflow Editor", href: "/flow", icon: Workflow, keywords: ["workflow", "agent", "pipeline"] },
  { id: "chat", label: "Chat", description: "KI-Chat", href: "/chat", icon: MessageSquare, keywords: ["nachricht", "message", "ai"] },
  { id: "search", label: "Suche", description: "Dokumente durchsuchen", href: "/search", icon: Search, keywords: ["find", "query"] },
  { id: "documents", label: "Dokumente", description: "Dateiverwaltung", href: "/documents", icon: Files, keywords: ["files", "upload", "pdf"] },
  { id: "gallery", label: "Galerie", description: "Bildergalerie", href: "/gallery", icon: Image, keywords: ["bilder", "images", "comfyui"] },
  { id: "audio", label: "Audio", description: "TTS & Musik", href: "/audio", icon: Music, keywords: ["tts", "speech", "musik", "ace"] },
  { id: "notes", label: "Notizen", description: "Markdown-Notizen", href: "/notes", icon: FileText, keywords: ["markdown", "editor"] },
  { id: "notes-graph", label: "Notizen › Graph", description: "Wissens-Graph", href: "/notes/graph", icon: FileText, keywords: ["graph", "knowledge", "visualize"] },
  { id: "terminal", label: "Terminal", description: "Shell-Zugriff", href: "/terminal", icon: Terminal, keywords: ["shell", "bash", "command"] },
  { id: "memories", label: "Memories", description: "Langzeitgedächtnis", href: "/memories", icon: Brain, keywords: ["memory", "remember", "context"] },
  { id: "settings", label: "Einstellungen", description: "App-Konfiguration", href: "/settings", icon: Settings, keywords: ["config", "options", "setup"] },
];

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalCommandPalette({ open, onOpenChange }: GlobalCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return COMMANDS;
    return COMMANDS.filter((cmd) =>
      [cmd.label, cmd.description, ...(cmd.keywords || [])]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  }, [activeIndex, filtered.length]);

  const handleSelect = (cmd: CommandItem) => {
    router.push(cmd.href);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      handleSelect(filtered[activeIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick Switch</DialogTitle>
          <DialogDescription>Schnell zwischen Bereichen wechseln</DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/60 p-3">
          <Input
            ref={inputRef}
            placeholder="Bereich suchen…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            className="border-0 shadow-none focus-visible:ring-0 text-base"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Keine Ergebnisse
            </div>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors",
                  i === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                )}
              >
                <Icon className="h-4.5 w-4.5 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{cmd.label}</div>
                  {cmd.description && (
                    <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border/40 px-3 py-2 text-xs text-muted-foreground flex items-center gap-3">
          <span><kbd className="font-mono">↑↓</kbd> Navigieren</span>
          <span><kbd className="font-mono">↵</kbd> Öffnen</span>
          <span><kbd className="font-mono">Esc</kbd> Schliessen</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
