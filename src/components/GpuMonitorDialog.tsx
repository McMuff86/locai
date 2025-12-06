"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Cpu, MemoryStick, Thermometer, Zap, Activity, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface GpuProcess {
  pid: number;
  name: string;
  memoryUsed: number;
  type: 'ollama' | 'comfyui' | 'other';
}

interface GpuStats {
  available: boolean;
  name: string;
  driver: string;
  vram: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  utilization: number;
  temperature: number;
  power: {
    current: number;
    limit: number;
  };
  processes: GpuProcess[];
}

interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  gpu: GpuStats;
  ollama: {
    running: boolean;
    models: {
      name: string;
      size: number;
      vram: number;
    }[];
    totalVram: number;
  };
}

interface GpuMonitorDialogProps {
  isGenerating?: boolean;
  children?: React.ReactNode;
}

// Progress Bar Component
const ProgressBar = ({ value, color = "primary", label }: { 
  value: number; 
  color?: string;
  label?: string;
}) => {
  const colorClasses: Record<string, string> = {
    primary: "bg-primary",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500"
  };
  
  const getAutoColor = () => {
    if (value > 90) return colorClasses.red;
    if (value > 70) return colorClasses.yellow;
    if (value > 50) return colorClasses.primary;
    return colorClasses.green;
  };
  
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value.toFixed(1)}%</span>
        </div>
      )}
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color === "auto" ? getAutoColor() : colorClasses[color] || colorClasses.primary} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
};

// Process Badge
const ProcessBadge = ({ process }: { process: GpuProcess }) => {
  const styles = {
    ollama: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '🦙' },
    comfyui: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', icon: '🎨' },
    other: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: '📦' }
  };
  
  const style = styles[process.type];
  
  return (
    <div className={cn(
      "flex items-center justify-between px-3 py-2 rounded-lg border",
      style.bg, style.text, style.border
    )}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{style.icon}</span>
        <div>
          <div className="font-medium text-sm">{process.name}</div>
          <div className="text-xs opacity-70">PID: {process.pid}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono font-bold">{process.memoryUsed} MB</div>
        <div className="text-xs opacity-70">VRAM</div>
      </div>
    </div>
  );
};

// Temperature Display
const TempDisplay = ({ temp }: { temp: number }) => {
  const getColor = () => {
    if (temp >= 85) return 'text-red-500 bg-red-500/20 border-red-500/30';
    if (temp >= 70) return 'text-amber-500 bg-amber-500/20 border-amber-500/30';
    if (temp >= 50) return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30';
    return 'text-emerald-500 bg-emerald-500/20 border-emerald-500/30';
  };

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", getColor())}>
      <Thermometer className="h-5 w-5" />
      <div>
        <div className="font-bold text-xl">{temp}°C</div>
        <div className="text-xs opacity-70">Temperature</div>
      </div>
    </div>
  );
};

export function GpuMonitorDialog({ isGenerating = false, children }: GpuMonitorDialogProps) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/system-stats');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (open) {
      fetchStats();
      const interval = setInterval(fetchStats, 2000);
      return () => clearInterval(interval);
    }
  }, [open, fetchStats]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="gap-2">
            <Monitor className="h-4 w-4" />
            GPU Monitor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-purple-500" />
            System & GPU Monitor
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8"
              onClick={fetchStats}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {!stats ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* CPU & RAM */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-card border space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">CPU</span>
                  {isGenerating && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-blue-500"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </div>
                <div className="text-2xl font-bold">{stats.cpu.usage}%</div>
                <ProgressBar value={stats.cpu.usage} color="auto" />
                <div className="text-xs text-muted-foreground">
                  {stats.cpu.cores} Cores • {stats.cpu.model.split('@')[0].trim()}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-card border space-y-3">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-5 w-5 text-emerald-500" />
                  <span className="font-medium">RAM</span>
                </div>
                <div className="text-2xl font-bold">
                  {stats.memory.used.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">/ {stats.memory.total.toFixed(0)} GB</span>
                </div>
                <ProgressBar value={stats.memory.usagePercent} color="auto" />
                <div className="text-xs text-muted-foreground">
                  {stats.memory.free.toFixed(1)} GB free
                </div>
              </div>
            </div>

            {/* GPU Section */}
            {stats.gpu.available ? (
              <div className="space-y-4">
                {/* GPU Header */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{stats.gpu.name}</h3>
                      <p className="text-sm text-muted-foreground">Driver Version: {stats.gpu.driver}</p>
                    </div>
                    <TempDisplay temp={stats.gpu.temperature} />
                  </div>

                  {/* VRAM & Utilization */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <ProgressBar 
                        value={stats.gpu.vram.usagePercent} 
                        color="purple" 
                        label="VRAM Usage"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{stats.gpu.vram.used.toFixed(1)} GB used</span>
                        <span>{stats.gpu.vram.free.toFixed(1)} GB free</span>
                      </div>
                      <div className="text-center text-lg font-bold text-purple-400">
                        {stats.gpu.vram.used.toFixed(1)} / {stats.gpu.vram.total.toFixed(0)} GB
                      </div>
                    </div>

                    <div className="space-y-2">
                      <ProgressBar 
                        value={stats.gpu.utilization} 
                        color="blue" 
                        label="GPU Utilization"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>⚡ {stats.gpu.power.current}W</span>
                        <span>Limit: {stats.gpu.power.limit}W</span>
                      </div>
                      <div className="text-center text-lg font-bold text-blue-400">
                        {stats.gpu.utilization}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* GPU Processes */}
                {stats.gpu.processes.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Activity className="h-4 w-4" />
                      GPU Processes ({stats.gpu.processes.length})
                    </div>
                    <div className="space-y-2">
                      {stats.gpu.processes.map((process, idx) => (
                        <ProcessBadge key={`${process.pid}-${idx}`} process={process} />
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      Total GPU Memory: {stats.gpu.processes.reduce((sum, p) => sum + p.memoryUsed, 0)} MB
                    </div>
                  </div>
                )}

                {/* Ollama Models */}
                {stats.ollama.running && stats.ollama.models.length > 0 && (
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-medium">
                      <span className="text-lg">🦙</span>
                      Ollama Models Loaded
                    </div>
                    <div className="space-y-2">
                      {stats.ollama.models.map((model, idx) => (
                        <div 
                          key={`${model.name}-${idx}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                        >
                          <div className="font-medium text-emerald-300">{model.name}</div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-emerald-400/70">Size: {model.size.toFixed(1)} GB</span>
                            <span className="font-bold text-emerald-400">VRAM: {model.vram.toFixed(1)} GB</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <Monitor className="h-12 w-12 mx-auto text-amber-500 mb-3" />
                <h3 className="font-medium text-amber-500 mb-1">No NVIDIA GPU Detected</h3>
                <p className="text-sm text-muted-foreground">
                  nvidia-smi is not available. Make sure you have an NVIDIA GPU with drivers installed.
                </p>
              </div>
            )}

            {/* Ollama Status */}
            {!stats.ollama.running && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-500 font-medium">Ollama is not running</span>
              </div>
            )}

            {/* Footer */}
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Auto-refreshes every 2 seconds while open
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default GpuMonitorDialog;

