"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Thermometer, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useSettings } from '../hooks/useSettings';

// ── Types ──────────────────────────────────────────────────────────

interface GpuFloatStats {
  available: boolean;
  name: string;
  utilization: number;
  temperature: number;
  vram: {
    used: number;
    total: number;
    usagePercent: number;
  };
  power: {
    current: number;
    limit: number;
  };
  ollamaRunning: boolean;
  ollamaModels: { name: string; vram: number }[];
}

interface GpuFloatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  isGenerating?: boolean;
}

// ── Progress micro-bar ─────────────────────────────────────────────

function MicroBar({ value, className }: { value: number; className?: string }) {
  const barColor = value > 90
    ? 'bg-red-500'
    : value > 70
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className={cn("h-1.5 w-full bg-muted rounded-full overflow-hidden", className)}>
      <motion.div
        className={cn("h-full rounded-full", barColor)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

// ── Temp color helper ──────────────────────────────────────────────

function tempColor(t: number): string {
  if (t >= 85) return 'text-red-500';
  if (t >= 70) return 'text-amber-500';
  return 'text-emerald-500';
}

// ── Main Widget ────────────────────────────────────────────────────

export function GpuFloatWidget({ isOpen, onToggle, isGenerating = false }: GpuFloatWidgetProps) {
  const { settings } = useSettings();
  const [stats, setStats] = useState<GpuFloatStats | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const baseUrl = '/api/system-stats';
      const url = settings?.ollamaHost
        ? `${baseUrl}?ollamaHost=${encodeURIComponent(settings.ollamaHost)}`
        : baseUrl;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setStats({
        available: data.gpu?.available ?? false,
        name: data.gpu?.name ?? 'Unknown',
        utilization: data.gpu?.utilization ?? 0,
        temperature: data.gpu?.temperature ?? 0,
        vram: {
          used: data.gpu?.vram?.used ?? 0,
          total: data.gpu?.vram?.total ?? 0,
          usagePercent: data.gpu?.vram?.usagePercent ?? 0,
        },
        power: {
          current: data.gpu?.power?.current ?? 0,
          limit: data.gpu?.power?.limit ?? 0,
        },
        ollamaRunning: data.ollama?.running ?? false,
        ollamaModels: data.ollama?.models ?? [],
      });
    } catch {
      // silently ignore
    }
  }, [settings?.ollamaHost]);

  useEffect(() => {
    if (!isOpen) return;
    fetchStats();
    const interval = setInterval(fetchStats, isGenerating ? 1500 : 3000);
    return () => clearInterval(interval);
  }, [fetchStats, isGenerating, isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    // Delay to prevent the opening click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onToggle]);

  // ── FAB Button ────────────────────────────────────────────────

  const utilColor = stats
    ? stats.utilization > 80
      ? 'ring-red-500/50'
      : stats.utilization > 40
        ? 'ring-amber-500/40'
        : 'ring-emerald-500/30'
    : '';

  return (
    <div className="fixed bottom-4 right-4 z-50" ref={panelRef}>
      <AnimatePresence mode="wait">
        {isOpen && stats ? (
          // ── Expanded Panel ──────────────────────────────────────
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="w-[300px] rounded-xl border bg-popover/95 backdrop-blur-md shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Activity className="h-4 w-4 text-primary" />
                GPU Monitor
              </div>
              <button
                onClick={onToggle}
                className="p-0.5 rounded hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {!stats.available ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No NVIDIA GPU detected
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {/* GPU Name */}
                <div className="text-[11px] text-muted-foreground truncate" title={stats.name}>
                  {stats.name}
                </div>

                {/* Utilization */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Utilization
                    </span>
                    <span className="font-medium tabular-nums">{stats.utilization}%</span>
                  </div>
                  <MicroBar value={stats.utilization} />
                </div>

                {/* VRAM */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">VRAM</span>
                    <span className="font-medium tabular-nums">
                      {stats.vram.used.toFixed(1)} / {stats.vram.total.toFixed(0)} GB
                    </span>
                  </div>
                  <MicroBar value={stats.vram.usagePercent} />
                </div>

                {/* Temperature + Power row */}
                <div className="flex justify-between text-xs">
                  <span className={cn("flex items-center gap-1 font-medium tabular-nums", tempColor(stats.temperature))}>
                    <Thermometer className="h-3 w-3" />
                    {stats.temperature}°C
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    ⚡ {stats.power.current}W / {stats.power.limit}W
                  </span>
                </div>

                {/* Ollama status */}
                <div className="pt-1 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      stats.ollamaRunning ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    Ollama {stats.ollamaRunning ? 'running' : 'offline'}
                  </div>
                  {stats.ollamaModels.length > 0 && (
                    <span>
                      🦙 {stats.ollamaModels.length} model{stats.ollamaModels.length !== 1 ? 's' : ''} loaded
                    </span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          // ── FAB Button ──────────────────────────────────────────
          <motion.button
            key="fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={onToggle}
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              "bg-popover border shadow-lg",
              "hover:bg-accent transition-colors",
              "ring-2",
              utilColor
            )}
            title="GPU Monitor"
          >
            <Activity className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GpuFloatWidget;
