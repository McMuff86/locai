"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, MemoryStick, Zap, Activity, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const ProgressBar = ({ value, max = 100, color = "primary" }: { value: number; max?: number; color?: string }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colorClasses = {
    primary: "bg-primary",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500"
  };
  
  const getColor = () => {
    if (percentage > 90) return colorClasses.red;
    if (percentage > 70) return colorClasses.yellow;
    if (percentage > 50) return colorClasses.primary;
    return colorClasses.green;
  };
  
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${color === "auto" ? getColor() : colorClasses[color as keyof typeof colorClasses] || colorClasses.primary} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
};

const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  percentage,
  isActive 
}: { 
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  percentage?: number;
  isActive?: boolean;
}) => (
  <div className={`
    flex flex-col gap-1.5 p-3 rounded-lg border transition-all duration-300
    ${isActive 
      ? 'bg-primary/10 border-primary/30 shadow-lg shadow-primary/10' 
      : 'bg-card/50 border-border/50 hover:border-border'
    }
  `}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
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
      <ProgressBar value={percentage} color="auto" />
    )}
  </div>
);

export function SystemMonitor({ 
  isGenerating = false, 
  refreshInterval = 2000,
  compact = false 
}: SystemMonitorProps) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/system-stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Could not fetch system stats');
      console.error('Error fetching system stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    
    // Faster refresh when generating
    const interval = setInterval(fetchStats, isGenerating ? 1000 : refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStats, isGenerating, refreshInterval]);

  if (error || !stats) {
    return null;
  }

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
        {stats.ollama.running && stats.ollama.totalVram > 0 && (
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium">{stats.ollama.totalVram.toFixed(1)} GB VRAM</span>
          </div>
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

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Cpu}
              label="CPU"
              value={`${stats.cpu.usage}%`}
              subValue={`${stats.cpu.cores} cores`}
              percentage={stats.cpu.usage}
              isActive={isGenerating && stats.cpu.usage > 30}
            />
            
            <StatCard
              icon={MemoryStick}
              label="RAM"
              value={`${stats.memory.used.toFixed(1)} GB`}
              subValue={`/ ${stats.memory.total.toFixed(0)} GB`}
              percentage={stats.memory.usagePercent}
              isActive={isGenerating}
            />
            
            {stats.ollama.running && (
              <>
                <StatCard
                  icon={Zap}
                  label="VRAM"
                  value={stats.ollama.totalVram > 0 ? `${stats.ollama.totalVram.toFixed(1)} GB` : 'Idle'}
                  subValue={stats.ollama.models.length > 0 ? 'in use' : 'available'}
                  isActive={stats.ollama.models.length > 0}
                />
                
                <StatCard
                  icon={Activity}
                  label="Model"
                  value={stats.ollama.models.length > 0 
                    ? stats.ollama.models[0].name.split(':')[0] 
                    : 'None'}
                  subValue={stats.ollama.models.length > 0 
                    ? `${stats.ollama.models[0].size.toFixed(1)} GB`
                    : 'loaded'}
                  isActive={isGenerating}
                />
              </>
            )}
          </div>

          {/* Ollama Status */}
          {!stats.ollama.running && (
            <div className="text-xs text-amber-500 flex items-center gap-2">
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

