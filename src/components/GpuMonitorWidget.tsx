"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Monitor, 
  Cpu, 
  MemoryStick, 
  Thermometer, 
  Zap, 
  Activity, 
  RefreshCw,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';
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

interface GpuMonitorWidgetProps {
  isGenerating?: boolean;
}

// Progress Bar
const ProgressBar = ({ value, color = "primary" }: { value: number; color?: string }) => {
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
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${color === "auto" ? getAutoColor() : colorClasses[color] || colorClasses.primary} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
};

// Temperature Badge
const TempBadge = ({ temp }: { temp: number }) => {
  const getStyle = () => {
    if (temp >= 85) return 'text-red-500 bg-red-500/20';
    if (temp >= 70) return 'text-amber-500 bg-amber-500/20';
    if (temp >= 50) return 'text-yellow-500 bg-yellow-500/20';
    return 'text-emerald-500 bg-emerald-500/20';
  };

  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", getStyle())}>
      🌡️ {temp}°C
    </span>
  );
};

// Process Item with Kill button
const ProcessItem = ({ 
  process, 
  onKill,
  isKilling 
}: { 
  process: GpuProcess; 
  onKill: (pid: number, name: string) => void;
  isKilling: boolean;
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  
  const styles = {
    ollama: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: '🦙', label: 'Ollama' },
    comfyui: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: '🎨', label: 'ComfyUI' },
    other: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: '📦', label: 'Other' }
  };
  
  const style = styles[process.type];
  
  return (
    <div className={cn("rounded-lg border p-2", style.bg, style.border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span>{style.icon}</span>
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{process.name}</div>
            <div className="text-[10px] text-muted-foreground">PID: {process.pid}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono">{process.memoryUsed} MB</span>
          {!showConfirm ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => setShowConfirm(true)}
              disabled={isKilling}
              title="Kill Process"
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => {
                  onKill(process.pid, process.name);
                  setShowConfirm(false);
                }}
                disabled={isKilling}
              >
                {isKilling ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Kill'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export function GpuMonitorWidget({ isGenerating = false }: GpuMonitorWidgetProps) {
  const { toast } = useToast();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [showCpuRam, setShowCpuRam] = useState(false);
  const [showProcesses, setShowProcesses] = useState(true);
  const [showOllama, setShowOllama] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/system-stats');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, isGenerating ? 1000 : 2000);
    return () => clearInterval(interval);
  }, [fetchStats, isGenerating]);

  // Kill process
  const killProcess = async (pid: number, processName: string) => {
    setKillingPid(pid);
    
    try {
      const response = await fetch('/api/gpu/kill-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, processName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to kill process');
      }

      toast({
        title: "Process Terminated",
        description: `${processName} (PID: ${pid}) has been terminated.`,
      });

      // Refresh stats after kill
      setTimeout(fetchStats, 500);
    } catch (error) {
      toast({
        title: "Failed to Kill Process",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setKillingPid(null);
    }
  };

  if (!stats) {
    return (
      <div className="p-4 flex items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 text-sm">
      {/* CPU/RAM Toggle Section */}
      <button
        onClick={() => setShowCpuRam(!showCpuRam)}
        className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-mono text-xs">{stats.cpu.usage}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MemoryStick className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-mono text-xs">{stats.memory.used.toFixed(1)} GB</span>
          </div>
        </div>
        {showCpuRam ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      <AnimatePresence>
        {showCpuRam && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2 overflow-hidden"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
              <div className="flex justify-between text-xs">
                <span>CPU ({stats.cpu.cores} cores)</span>
                <span className="font-medium">{stats.cpu.usage}%</span>
              </div>
              <ProgressBar value={stats.cpu.usage} color="auto" />
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <div className="flex justify-between text-xs">
                <span>RAM</span>
                <span className="font-medium">{stats.memory.used.toFixed(1)} / {stats.memory.total.toFixed(0)} GB</span>
              </div>
              <ProgressBar value={stats.memory.usagePercent} color="auto" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GPU Section */}
      {stats.gpu.available ? (
        <>
          {/* GPU Header */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium text-xs truncate flex-1">{stats.gpu.name}</div>
              <TempBadge temp={stats.gpu.temperature} />
            </div>
            
            {/* VRAM Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">VRAM</span>
                <span className="font-medium">
                  {stats.gpu.vram.used.toFixed(1)} / {stats.gpu.vram.total.toFixed(0)} GB
                </span>
              </div>
              <ProgressBar value={stats.gpu.vram.usagePercent} color="purple" />
            </div>

            {/* GPU Utilization */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5" />
                <span>Utilization</span>
              </div>
              <span className="font-medium">{stats.gpu.utilization}%</span>
            </div>
            <ProgressBar value={stats.gpu.utilization} color="blue" />

            {/* Power */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>⚡ Power</span>
              <span>{stats.gpu.power.current}W / {stats.gpu.power.limit}W</span>
            </div>
          </div>

          {/* GPU Processes */}
          {stats.gpu.processes.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowProcesses(!showProcesses)}
                className="w-full flex items-center justify-between text-xs font-medium"
              >
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  GPU Processes ({stats.gpu.processes.length})
                </div>
                {showProcesses ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              <AnimatePresence>
                {showProcesses && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    {/* Warning */}
                    <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-500">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span>Killing processes may cause data loss. Use with caution.</span>
                    </div>
                    
                    {stats.gpu.processes.map((process, idx) => (
                      <ProcessItem
                        key={`${process.pid}-${idx}`}
                        process={process}
                        onKill={killProcess}
                        isKilling={killingPid === process.pid}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Ollama Models */}
          {stats.ollama.running && stats.ollama.models.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowOllama(!showOllama)}
                className="w-full flex items-center justify-between text-xs font-medium text-emerald-400"
              >
                <div className="flex items-center gap-1.5">
                  <span>🦙</span>
                  Ollama Models ({stats.ollama.models.length})
                </div>
                {showOllama ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              <AnimatePresence>
                {showOllama && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    {stats.ollama.models.map((model, idx) => (
                      <div 
                        key={`${model.name}-${idx}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs"
                      >
                        <span className="font-medium text-emerald-300 truncate">{model.name}</span>
                        <span className="text-emerald-400 font-mono">{model.vram.toFixed(1)} GB</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      ) : (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <Monitor className="h-8 w-8 mx-auto text-amber-500 mb-2" />
          <p className="text-xs text-amber-500">No NVIDIA GPU detected</p>
        </div>
      )}

      {/* Status indicators */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full",
            stats.ollama.running ? "bg-emerald-500" : "bg-amber-500"
          )} />
          <span>Ollama {stats.ollama.running ? 'running' : 'offline'}</span>
        </div>
        <span>Updates: {isGenerating ? '1s' : '2s'}</span>
      </div>
    </div>
  );
}

export default GpuMonitorWidget;

