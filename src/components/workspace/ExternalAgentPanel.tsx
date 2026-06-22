"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, RefreshCw, Send, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  ExternalAgentMode,
  ExternalAgentProvider,
  ExternalAgentRunResult,
  ExternalAgentStatus,
} from '@/lib/external-agents/types';

interface StatusResponse {
  success: boolean;
  agents: Record<ExternalAgentProvider, ExternalAgentStatus>;
}

interface RunResponse {
  success: boolean;
  result: ExternalAgentRunResult;
  run?: { id: string };
  error?: string;
}

interface ExternalAgentPanelProps {
  projectId: string | null;
  artifactId?: string | null;
  onRunComplete?: () => void;
}

const PROVIDERS: Array<{ id: ExternalAgentProvider; label: string }> = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude-code', label: 'Claude Code' },
];

export function ExternalAgentPanel({
  projectId,
  artifactId,
  onRunComplete,
}: ExternalAgentPanelProps) {
  const [provider, setProvider] = useState<ExternalAgentProvider>('codex');
  const [mode, setMode] = useState<ExternalAgentMode>('plan');
  const [prompt, setPrompt] = useState('');
  const [cwd, setCwd] = useState('');
  const [statuses, setStatuses] = useState<Record<ExternalAgentProvider, ExternalAgentStatus> | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExternalAgentRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedStatus = statuses?.[provider];
  const canRun = !!projectId && !!prompt.trim() && selectedStatus?.enabled && !isRunning;

  const loadStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const response = await fetch('/api/external-agents/status');
      const data = (await response.json()) as StatusResponse;
      if (data.success) setStatuses(data.agents);
    } catch {
      setStatuses(null);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const providerOptions = useMemo(() => {
    return PROVIDERS.map((option) => ({
      ...option,
      status: statuses?.[option.id],
    }));
  }, [statuses]);

  const runAgent = useCallback(async () => {
    if (!canRun || !projectId) return;

    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/external-agents/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          mode,
          prompt,
          cwd: cwd.trim() || undefined,
          projectId,
          artifactId: artifactId || undefined,
        }),
      });
      const data = (await response.json()) as RunResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'External agent run failed');
      }
      setResult(data.result);
      onRunComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'External agent run failed');
    } finally {
      setIsRunning(false);
    }
  }, [artifactId, canRun, cwd, mode, onRunComplete, projectId, prompt, provider]);

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="h-4 w-4 text-primary" />
          External Agents
          {selectedStatus && (
            <Badge variant={selectedStatus.available ? 'outline' : 'secondary'} className="rounded-md">
              {selectedStatus.available ? 'ready' : selectedStatus.enabled ? 'check' : 'off'}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadStatus()} disabled={isLoadingStatus}>
          {isLoadingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Status
        </Button>
      </div>

      <div className="grid gap-2 lg:grid-cols-[140px_140px_minmax(0,1fr)]">
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as ExternalAgentProvider)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {providerOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as ExternalAgentMode)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="plan">Plan</option>
          <option value="edit">Edit</option>
        </select>

        <Input
          value={cwd}
          onChange={(event) => setCwd(event.target.value)}
          placeholder="Arbeitsordner leer = Default"
        />
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Aufgabe für Codex oder Claude Code"
          className="min-h-20 resize-y"
        />
        <Button onClick={() => void runAgent()} disabled={!canRun} className="lg:h-20">
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Run
        </Button>
      </div>

      {selectedStatus?.error && (
        <div className="mt-2 text-xs text-muted-foreground">
          {selectedStatus.executable}: {selectedStatus.error}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-2 rounded-md border bg-background/70 p-3 text-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{result.provider}</span>
            <Badge variant={result.success ? 'outline' : 'destructive'} className="rounded-md">
              exit {result.exitCode ?? 'n/a'}
            </Badge>
            {result.changedFiles.length > 0 && (
              <Badge variant="secondary" className="rounded-md">
                {result.changedFiles.length} Dateien geändert
              </Badge>
            )}
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
            {result.stdout || result.stderr || 'Kein Output'}
          </pre>
        </div>
      )}
    </div>
  );
}
