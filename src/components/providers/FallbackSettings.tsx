'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProviderType } from '@/lib/providers/types';

// ---------------------------------------------------------------------------
// Types (mirrored from server — no fs import on client)
// ---------------------------------------------------------------------------

interface FallbackModelMapping {
  localModel: string;
  cloudModel: string;
  cloudProvider: ProviderType;
}

interface FallbackConfig {
  enabled: boolean;
  timeoutMs: number;
  providerOrder: ProviderType[];
  modelMappings: FallbackModelMapping[];
}

interface FallbackEvent {
  timestamp: string;
  originalProvider: ProviderType;
  originalModel: string;
  fallbackProvider: ProviderType;
  fallbackModel: string;
  reason: 'timeout' | 'error' | 'unreachable';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FallbackSettings() {
  const [config, setConfig] = useState<FallbackConfig | null>(null);
  const [events, setEvents] = useState<FallbackEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [newMapping, setNewMapping] = useState({ localModel: '', cloudModel: '', cloudProvider: 'openai' as ProviderType });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/providers/fallback');
      const data = await res.json();
      setConfig(data.config);
      setEvents(data.events || []);
    } catch {
      // best effort
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (updated: FallbackConfig) => {
    setSaving(true);
    try {
      await fetch('/api/providers/fallback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setConfig(updated);
    } catch {
      // best effort
    }
    setSaving(false);
  }, []);

  if (!config) {
    return <div className="text-muted-foreground text-sm">Loading fallback settings…</div>;
  }

  const providerLabels: Record<ProviderType, string> = {
    ollama: 'Ollama',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    openrouter: 'OpenRouter',
  };

  return (
    <div className="space-y-4">
      {/* Enable/Disable */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">Automatic Fallback</span>
          <p className="text-xs text-muted-foreground">
            Automatically switch to a cloud provider when Ollama is slow or unreachable.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => save({ ...config, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {config.enabled && (
        <>
          {/* Timeout */}
          <div>
            <label className="text-sm font-medium">Timeout (seconds)</label>
            <input
              type="number"
              min={5}
              max={120}
              value={config.timeoutMs / 1000}
              onChange={(e) => save({ ...config, timeoutMs: Number(e.target.value) * 1000 })}
              className="ml-2 w-20 px-2 py-1 bg-muted rounded text-sm"
            />
            <span className="text-xs text-muted-foreground ml-2">
              Time to wait for first token before switching
            </span>
          </div>

          {/* Provider Order */}
          <div>
            <label className="text-sm font-medium">Fallback Provider Order</label>
            <div className="flex gap-2 mt-1">
              {config.providerOrder.map((p, i) => (
                <div key={p} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm">
                  <span className="text-muted-foreground text-xs">{i + 1}.</span>
                  {providerLabels[p]}
                  {i > 0 && (
                    <button
                      onClick={() => {
                        const order = [...config.providerOrder];
                        [order[i - 1], order[i]] = [order[i], order[i - 1]];
                        save({ ...config, providerOrder: order });
                      }}
                      className="text-xs hover:text-foreground text-muted-foreground"
                      title="Move up"
                    >↑</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Model Mappings */}
          <div>
            <label className="text-sm font-medium">Model Mappings</label>
            <div className="space-y-1 mt-1">
              {config.modelMappings.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 px-2 py-1 rounded">
                  <span className="font-mono text-xs">{m.localModel}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-xs">{m.cloudModel}</span>
                  <span className="text-xs text-muted-foreground">({providerLabels[m.cloudProvider]})</span>
                  <button
                    onClick={() => {
                      const mappings = config.modelMappings.filter((_, j) => j !== i);
                      save({ ...config, modelMappings: mappings });
                    }}
                    className="ml-auto text-xs text-red-400 hover:text-red-300"
                  >✕</button>
                </div>
              ))}
              {/* Add new mapping */}
              <div className="flex items-center gap-2 text-sm mt-2">
                <input
                  placeholder="Local model"
                  value={newMapping.localModel}
                  onChange={(e) => setNewMapping({ ...newMapping, localModel: e.target.value })}
                  className="px-2 py-1 bg-muted rounded text-xs w-32"
                />
                <span className="text-muted-foreground">→</span>
                <input
                  placeholder="Cloud model"
                  value={newMapping.cloudModel}
                  onChange={(e) => setNewMapping({ ...newMapping, cloudModel: e.target.value })}
                  className="px-2 py-1 bg-muted rounded text-xs w-32"
                />
                <select
                  value={newMapping.cloudProvider}
                  onChange={(e) => setNewMapping({ ...newMapping, cloudProvider: e.target.value as ProviderType })}
                  className="px-2 py-1 bg-muted rounded text-xs"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
                <button
                  onClick={() => {
                    if (newMapping.localModel && newMapping.cloudModel) {
                      save({
                        ...config,
                        modelMappings: [...config.modelMappings, newMapping],
                      });
                      setNewMapping({ localModel: '', cloudModel: '', cloudProvider: 'openai' });
                    }
                  }}
                  className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-500/30"
                >+ Add</button>
              </div>
            </div>
          </div>

          {/* Recent fallback events */}
          {events.length > 0 && (
            <div>
              <label className="text-sm font-medium">Recent Fallback Events</label>
              <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
                {events.slice(-10).reverse().map((e, i) => (
                  <div key={i} className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded flex gap-2">
                    <span>⚡</span>
                    <span>{e.originalModel} → {e.fallbackModel}</span>
                    <span className="text-muted-foreground">({e.reason})</span>
                    <span className="ml-auto text-muted-foreground">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
    </div>
  );
}
