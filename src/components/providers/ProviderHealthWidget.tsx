"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
  Brain,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirrors API response)
// ---------------------------------------------------------------------------

interface ProviderHealth {
  name: string;
  type: string;
  status: "online" | "offline" | "degraded";
  latencyMs: number;
  models: string[];
  error?: string;
}

interface HealthResponse {
  providers: ProviderHealth[];
  recommendation: {
    fast: string | null;
    complex: string | null;
  };
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const statusColor: Record<string, string> = {
  online: "bg-emerald-500",
  degraded: "bg-yellow-500",
  offline: "bg-red-500",
};

const statusLabel: Record<string, string> = {
  online: "Online",
  degraded: "Eingeschränkt",
  offline: "Offline",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProviderHealthWidget() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/providers/health");
      if (res.ok) {
        const json: HealthResponse = await res.json();
        setData(json);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return (
      <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Provider-Status wird geladen…
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const onlineCount = data.providers.filter((p) => p.status === "online").length;

  return (
    <Card className="p-4 bg-card/50 backdrop-blur border-border/50 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Provider Status</span>
          <Badge variant="secondary" className="text-xs">
            {onlineCount}/{data.providers.length} online
          </Badge>
        </div>
        <button
          onClick={() => fetchHealth(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Provider List */}
      <div className="space-y-2">
        {data.providers.map((provider) => {
          const isExpanded = expanded === provider.type;
          return (
            <div
              key={provider.type}
              className="rounded-lg bg-muted/30 border border-border/30 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpanded(isExpanded ? null : provider.type)
                }
                className="w-full flex items-center justify-between p-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  {/* Status dot */}
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColor[provider.status]}`}
                  />
                  <span className="text-sm font-medium">{provider.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {statusLabel[provider.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {provider.status === "online" && (
                    <>
                      <Badge
                        variant="outline"
                        className="text-xs font-mono px-1.5 py-0"
                      >
                        {provider.latencyMs}ms
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0"
                      >
                        {provider.models.length} Modelle
                      </Badge>
                    </>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded model list */}
              {isExpanded && (
                <div className="px-3 pb-2.5 pt-0">
                  {provider.error && (
                    <p className="text-xs text-destructive mb-1.5">
                      {provider.error}
                    </p>
                  )}
                  {provider.models.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {provider.models.map((model) => (
                        <Badge
                          key={model}
                          variant="outline"
                          className="text-xs font-mono"
                        >
                          {model}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Keine Modelle verfügbar
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {(data.recommendation.fast || data.recommendation.complex) && (
        <div className="pt-2 border-t border-border/30 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">
            Empfehlungen
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {data.recommendation.fast && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span>Schnell:</span>
                <code className="bg-muted px-1 rounded font-mono">
                  {data.recommendation.fast}
                </code>
              </div>
            )}
            {data.recommendation.complex && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Brain className="h-3 w-3 text-purple-500" />
                <span>Komplex:</span>
                <code className="bg-muted px-1 rounded font-mono">
                  {data.recommendation.complex}
                </code>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
