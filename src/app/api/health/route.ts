import { ollamaFetch } from "@/lib/ollama-agent";
import { NextResponse } from 'next/server';
import { resolveAndValidateOllamaHost } from '../_utils/ollama';
import { apiError } from '../_utils/responses';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'error' | 'unavailable';
  latencyMs?: number;
  error?: string;
  version?: string;
}

async function checkOllama(host: string): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const res = await ollamaFetch(`${host}/api/version`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { name: 'ollama', status: 'error', latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { name: 'ollama', status: 'ok', latencyMs: Date.now() - start, version: data.version };
  } catch (err) {
    return { name: 'ollama', status: 'unavailable', latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkComfyUI(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    // Read ComfyUI settings from the same place the app uses
    const settingsRes = await fetch('http://localhost:3000/api/settings', {
      signal: AbortSignal.timeout(3000),
    });
    let comfyHost = 'http://localhost:8188';
    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      if (settings.comfyUIPort) {
        comfyHost = `http://localhost:${settings.comfyUIPort}`;
      }
    }

    const res = await fetch(`${comfyHost}/system_stats`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { name: 'comfyui', status: 'error', latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    }
    return { name: 'comfyui', status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { name: 'comfyui', status: 'unavailable', latencyMs: Date.now() - start };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawOllamaHost = searchParams.get('ollamaHost') || undefined;

  let ollamaHost: string;
  try {
    ollamaHost = resolveAndValidateOllamaHost(rawOllamaHost);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
  }

  const [ollama, comfyui] = await Promise.all([
    checkOllama(ollamaHost),
    checkComfyUI(),
  ]);

  const services = [ollama, comfyui];
  const allOk = services.every((s) => s.status === 'ok');

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
    },
    { status: allOk ? 200 : 503 },
  );
}
