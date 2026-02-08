"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, MemoryStick, Zap, Activity, Server, Thermometer, Monitor, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useSettings } from '../hooks/useSettings';

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

interface SystemMonitorProps {
  isGenerating?: boolean;
  refreshInterval?: number;
  compact?: boolean;
}

const ProgressBar = ({ value, max = 100, color = "primary", showLabel = false }: { 
  value: number; 
  max?: number; 
  color?: string;
  showLabel?: boolean;
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colorClasses = {
    primary: "bg-primary",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500"
  };
  
  const getColor = () => {
    if (percentage > 90) return colorClasses.red;
    if (percentage > 70) return colorClasses.yellow;
    if (percentage > 50) return colorClasses.primary;
    return colorClasses.green;
  };
  
  return (
    <div className="relative">
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color === "auto" ? getColor() : colorClasses[color as keyof typeof colorClasses] || colorClasses.primary} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {showLabel && (
        <span className="absolute right-0 -top-5 text-xs text-muted-foreground">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};

const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  percentage,
  isActive,
  color = "primary"
}: { 
  icon: React.ElementType<{ className?: string }>;
  label: string;
  value: string;
  subValue?: string;
  percentage?: number;
  isActive?: boolean;
  color?: string;
}) => (
  <div className={cn(
    "flex flex-col gap-1.5 p-3 rounded-lg border transition-all duration-300",
    isActive 
      ? 'bg-primary/10 border-primary/30 shadow-lg shadow-primary/10' 
      : 'bg-card/50 border-border/50 hover:border-border'
  )}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", isActive ? 'text-primary' : 'text-muted-foreground')} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      {isActive && (
        <motion.div
          className="h-2 w-2 rounded-full bg-primary"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-bold">{value}</span>
      {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
    </div>
    {percentage !== undefined && (
      <ProgressBar value={percentage} color={color} />
    )}
  </div>
);

// GPU Process Badge
const ProcessBadge = ({ process }: { process: GpuProcess }) => {
  const typeColors = {
    ollama: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    comfyui: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    other: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  };

  const typeIcons = {
    ollama: '🦙',
    comfyui: '🎨',
    other: '📦'
  };

  return (
    <div className={cn(
      "flex items-center justify-between px-2 py-1.5 rounded-md border text-xs",
      typeColors[process.type]
    )}>
      <div className="flex items-center gap-2">
        <span>{typeIcons[process.type]}</span>
        <span className="font-medium truncate max-w-[120px]">{process.name}</span>
      </div>
      <span className="font-mono">{process.memoryUsed} MB</span>
    </div>
  );
};

// Temperature indicator with color coding
const TempIndicator = ({ temp }: { temp: number }) => {
  const getColor = () => {
    if (temp >= 85) return 'text-red-500';
    if (temp >= 70) return 'text-amber-500';
    if (temp >= 50) return 'text-yellow-500';
    return 'text-emerald-500';
  };

  return (
    <div className={cn("flex items-center gap-1", getColor())}>
      <Thermometer className="h-3.5 w-3.5" />
      <span className="font-medium">{temp}°C</span>
    </div>
  );
};

export function SystemMonitor({ 
  isGenerating = false, 
  refreshInterval = 2000,
  compact = false 
}: SystemMonitorProps) {
  const { settings } = useSettings();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [showGpuDetails, setShowGpuDetails] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const baseUrl = '/api/system-stats';
      const url = settings?.ollamaHost
        ? `${baseUrl}?ollamaHost=${encodeURIComponent(settings.ollamaHost)}`
        : baseUrl;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Could not fetch system stats');
      console.error('Error fetching system stats:', err);
    }
  }, [settings?.ollamaHost]);

  useEffect(() => {
    fetchStats();
    
    // Faster refresh when generating
    const interval = setInterval(fetchStats, isGenerating ? 1000 : refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStats, isGenerating, refreshInterval]);

  if (error || !stats) {
    return null;
  }

  // Compact view
  if (compact) {
    return (
      <motion.div 
        className="flex items-center gap-4 px-3 py-2 bg-card/30 rounded-lg border border-border/30 text-xs"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">{stats.cpu.usage}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MemoryStick className="h-3.5 w-3.5 text-emerald-500" />
          <span className="font-medium">{stats.memory.used.toFixed(1)} GB</span>
        </div>
        {stats.gpu.available && (
          <>
            <div className="flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-purple-500" />
              <span className="font-medium">{stats.gpu.vram.used.toFixed(1)}/{stats.gpu.vram.total.toFixed(0)} GB</span>
            </div>
            <TempIndicator temp={stats.gpu.temperature} />
          </>
        )}
        {isGenerating && (
          <motion.div
            className="flex items-center gap-1.5 text-primary"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="font-medium">Generating...</span>
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="w-full space-y-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">System Resources</span>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Hide
            </button>
          </div>

          {/* CPU & RAM Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Cpu}
              label="CPU"
              value={`${stats.cpu.usage}%`}
              subValue={`${stats.cpu.cores} cores`}
              percentage={stats.cpu.usage}
              isActive={isGenerating && stats.cpu.usage > 30}
              color="auto"
            />
            
            <StatCard
              icon={MemoryStick}
              label="RAM"
              value={`${stats.memory.used.toFixed(1)} GB`}
              subValue={`/ ${stats.memory.total.toFixed(0)} GB`}
              percentage={stats.memory.usagePercent}
              isActive={isGenerating}
              color="auto"
            />
          </div>

          {/* GPU Section */}
          {stats.gpu.available && (
            <div className="space-y-2">
              {/* GPU Header */}
              <button
                onClick={() => setShowGpuDetails(!showGpuDetails)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-purple-400" />
                  <div className="text-left">
                    <div className="text-sm font-medium">{stats.gpu.name}</div>
                    <div className="text-xs text-muted-foreground">Driver {stats.gpu.driver}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <TempIndicator temp={stats.gpu.temperature} />
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      {stats.gpu.vram.used.toFixed(1)} / {stats.gpu.vram.total.toFixed(0)} GB
                    </div>
                    <div className="text-xs text-muted-foreground">VRAM</div>
                  </div>
                  {showGpuDetails ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* GPU Details (Expandable) */}
              <AnimatePresence>
                {showGpuDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    {/* VRAM & Utilization Bars */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-card/50 border border-border/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">VRAM Usage</span>
                          <span className="font-medium">{stats.gpu.vram.usagePercent.toFixed(1)}%</span>
                        </div>
                        <ProgressBar value={stats.gpu.vram.usagePercent} color="purple" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{stats.gpu.vram.used.toFixed(1)} GB used</span>
                          <span>{stats.gpu.vram.free.toFixed(1)} GB free</span>
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-card/50 border border-border/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">GPU Utilization</span>
                          <span className="font-medium">{stats.gpu.utilization}%</span>
                        </div>
                        <ProgressBar value={stats.gpu.utilization} color="blue" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>⚡ {stats.gpu.power.current}W</span>
                          <span>/ {stats.gpu.power.limit}W limit</span>
                        </div>
                      </div>
                    </div>

                    {/* GPU Processes */}
                    {stats.gpu.processes.length > 0 && (
                      <div className="p-3 rounded-lg bg-card/50 border border-border/50 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Activity className="h-3.5 w-3.5" />
                          <span>GPU Processes ({stats.gpu.processes.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {stats.gpu.processes.map((process, idx) => (
                            <ProcessBadge key={`${process.pid}-${idx}`} process={process} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ollama Models (if any loaded) */}
                    {stats.ollama.running && stats.ollama.models.length > 0 && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-emerald-400 mb-2">
                          <span>🦙</span>
                          <span>Ollama Models Loaded</span>
                        </div>
                        <div className="space-y-1.5">
                          {stats.ollama.models.map((model, idx) => (
                            <div 
                              key={`${model.name}-${idx}`}
                              className="flex items-center justify-between px-2 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs"
                            >
                              <span className="font-medium text-emerald-300">{model.name}</span>
                              <div className="flex items-center gap-3 text-emerald-400/80">
                                <span>{model.size.toFixed(1)} GB</span>
                                <span className="text-emerald-400">VRAM: {model.vram.toFixed(1)} GB</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* No GPU / Ollama Status */}
          {!stats.gpu.available && (
            <div className="text-xs text-amber-500 flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Monitor className="h-4 w-4" />
              <span>No NVIDIA GPU detected (nvidia-smi not available)</span>
            </div>
          )}

          {!stats.ollama.running && (
            <div className="text-xs text-amber-500 flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              Ollama not running
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SystemMonitor;
