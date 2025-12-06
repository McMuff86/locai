import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * System Stats API
 * Returns CPU, RAM, GPU usage and Ollama model information
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

interface GpuProcess {
  pid: number;
  name: string;
  memoryUsed: number; // MB
  type: 'ollama' | 'comfyui' | 'other';
}

interface GpuStats {
  available: boolean;
  name: string;
  driver: string;
  vram: {
    total: number;  // GB
    used: number;   // GB
    free: number;   // GB
    usagePercent: number;
  };
  utilization: number;  // %
  temperature: number;  // °C
  power: {
    current: number;  // W
    limit: number;    // W
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

// Detect process type from name
function detectProcessType(processName: string): GpuProcess['type'] {
  const name = processName.toLowerCase();
  
  if (name.includes('ollama')) {
    return 'ollama';
  }
  
  // ComfyUI runs as python process
  if (name.includes('python') || name.includes('comfy')) {
    return 'comfyui';
  }
  
  return 'other';
}

// Get GPU stats using nvidia-smi
async function getGpuStats(): Promise<GpuStats> {
  const defaultStats: GpuStats = {
    available: false,
    name: 'No GPU detected',
    driver: '',
    vram: { total: 0, used: 0, free: 0, usagePercent: 0 },
    utilization: 0,
    temperature: 0,
    power: { current: 0, limit: 0 },
    processes: []
  };

  try {
    // Query GPU info with nvidia-smi
    const { stdout: gpuInfo } = await execAsync(
      'nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw,power.limit --format=csv,noheader,nounits',
      { timeout: 5000 }
    );

    const parts = gpuInfo.trim().split(', ').map(s => s.trim());
    
    if (parts.length < 9) {
      return defaultStats;
    }

    const [name, driver, memTotal, memUsed, memFree, utilization, temperature, powerDraw, powerLimit] = parts;
    
    const totalMB = parseFloat(memTotal) || 0;
    const usedMB = parseFloat(memUsed) || 0;
    const freeMB = parseFloat(memFree) || 0;

    // Get GPU processes
    let processes: GpuProcess[] = [];
    try {
      const { stdout: processInfo } = await execAsync(
        'nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader,nounits',
        { timeout: 5000 }
      );

      if (processInfo.trim()) {
        processes = processInfo.trim().split('\n').map(line => {
          const [pid, processName, memory] = line.split(', ').map(s => s.trim());
          // Extract just the executable name from full path
          const name = processName.split(/[/\\]/).pop() || processName;
          return {
            pid: parseInt(pid) || 0,
            name,
            memoryUsed: parseFloat(memory) || 0,
            type: detectProcessType(name)
          };
        }).filter(p => p.pid > 0);
      }
    } catch {
      // No processes or error - that's fine
    }

    return {
      available: true,
      name: name || 'Unknown GPU',
      driver: driver || '',
      vram: {
        total: Math.round(totalMB / 1024 * 100) / 100,  // Convert to GB
        used: Math.round(usedMB / 1024 * 100) / 100,
        free: Math.round(freeMB / 1024 * 100) / 100,
        usagePercent: totalMB > 0 ? Math.round((usedMB / totalMB) * 1000) / 10 : 0
      },
      utilization: parseFloat(utilization) || 0,
      temperature: parseFloat(temperature) || 0,
      power: {
        current: Math.round(parseFloat(powerDraw) || 0),
        limit: Math.round(parseFloat(powerLimit) || 0)
      },
      processes
    };
  } catch (error) {
    // nvidia-smi not available or failed
    console.log('nvidia-smi not available:', error instanceof Error ? error.message : 'Unknown error');
    return defaultStats;
  }
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
    const [cpuUsage, gpuStats, ollamaStats] = await Promise.all([
      getCpuUsage(),
      getGpuStats(),
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
      gpu: gpuStats,
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
