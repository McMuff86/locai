"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import {
  Music,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface AceStepWidgetProps {
  aceStepPath: string;
  aceStepUrl: string;
}

export function AceStepWidget({ aceStepPath, aceStepUrl }: AceStepWidgetProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    try {
      const response = await fetch('/api/ace-step/health');
      const data = await response.json();
      setIsRunning(data.status === 'ok' || data.healthy === true);
    } catch {
      setIsRunning(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const launchAceStep = async () => {
    if (!aceStepPath) {
      setError('ACE-Step Pfad nicht konfiguriert');
      return;
    }

    setIsLaunching(true);
    setError(null);

    try {
      const response = await fetch('/api/ace-step/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aceStepPath }),
      });

      const data = await response.json();

      if (data.success) {
        // ACE-Step takes a while to load models, poll more frequently
        const pollInterval = setInterval(async () => {
          try {
            const res = await fetch('/api/ace-step/health');
            const d = await res.json();
            if (d.status === 'ok' || d.healthy === true) {
              setIsRunning(true);
              setIsLaunching(false);
              clearInterval(pollInterval);
            }
          } catch { /* still starting */ }
        }, 3000);

        // Stop polling after 120s (model loading can take long)
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsLaunching(false);
        }, 120000);
      } else {
        setError(data.error || 'Launch failed');
        setIsLaunching(false);
      }
    } catch {
      setError('Failed to launch ACE-Step');
      setIsLaunching(false);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-muted/30 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          <span className="font-medium">ACE-Step</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={checkHealth}
          disabled={isChecking}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        {isChecking && !isLaunching ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Prüfe...</span>
          </>
        ) : isLaunching ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            <span className="text-cyan-400">Startet... (Modelle werden geladen)</span>
          </>
        ) : isRunning ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-green-500">Läuft auf {aceStepUrl || 'http://localhost:8001'}</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Nicht gestartet</span>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      {/* Actions */}
      {!isRunning && !isLaunching && (
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={launchAceStep}
          disabled={!aceStepPath}
        >
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Starten
        </Button>
      )}

      {!aceStepPath && (
        <p className="text-xs text-muted-foreground">
          Konfiguriere den ACE-Step Pfad unten
        </p>
      )}
    </div>
  );
}

export default AceStepWidget;
