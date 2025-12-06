import { NextResponse } from 'next/server';
import os from 'os';

/**
 * System Stats API
 * Returns CPU, RAM usage and Ollama model information
 */

interface OllamaModel {
  name: string;
  model: string;
  size: number;
  size_vram: number;
  expires_at: string;
}

interface OllamaPsResponse {
  models: OllamaModel[];
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

// Calculate CPU usage (averaged over cores)
function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const cpus1 = os.cpus();
    
    setTimeout(() => {
      const cpus2 = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus2.forEach((cpu, i) => {
        const cpu1 = cpus1[i];
        
        const idle1 = cpu1.times.idle;
        const idle2 = cpu.times.idle;
        
        const total1 = Object.values(cpu1.times).reduce((a, b) => a + b, 0);
        const total2 = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        
        totalIdle += idle2 - idle1;
        totalTick += total2 - total1;
      });
      
      const usage = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0;
      resolve(Math.round(usage * 10) / 10);
    }, 100);
  });
}

// Get memory stats
function getMemoryStats() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  
  return {
    total: Math.round(total / (1024 * 1024 * 1024) * 100) / 100, // GB
    free: Math.round(free / (1024 * 1024 * 1024) * 100) / 100,
    used: Math.round(used / (1024 * 1024 * 1024) * 100) / 100,
    usagePercent: Math.round((used / total) * 1000) / 10
  };
}

// Get Ollama running models
async function getOllamaStats(): Promise<SystemStats['ollama']> {
  try {
    const response = await fetch('http://localhost:11434/api/ps', {
      signal: AbortSignal.timeout(2000)
    });
    
    if (!response.ok) {
      return { running: false, models: [], totalVram: 0 };
    }
    
    const data = await response.json() as OllamaPsResponse;
    
    const models = data.models.map(m => ({
      name: m.name,
      size: Math.round(m.size / (1024 * 1024 * 1024) * 100) / 100, // GB
      vram: Math.round((m.size_vram || 0) / (1024 * 1024 * 1024) * 100) / 100 // GB
    }));
    
    const totalVram = models.reduce((sum, m) => sum + m.vram, 0);
    
    return {
      running: true,
      models,
      totalVram: Math.round(totalVram * 100) / 100
    };
  } catch {
    return { running: false, models: [], totalVram: 0 };
  }
}

export async function GET() {
  try {
    const [cpuUsage, ollamaStats] = await Promise.all([
      getCpuUsage(),
      getOllamaStats()
    ]);
    
    const memoryStats = getMemoryStats();
    const cpuInfo = os.cpus()[0];
    
    const stats: SystemStats = {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        model: cpuInfo?.model || 'Unknown'
      },
      memory: memoryStats,
      ollama: ollamaStats
    };
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting system stats:', error);
    return NextResponse.json(
      { error: 'Failed to get system stats' },
      { status: 500 }
    );
  }
}

