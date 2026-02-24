"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import {
  Mic,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface QwenTTSWidgetProps {
  qwenTTSPath: string;
  qwenTTSUrl: string;
}

export function QwenTTSWidget({ qwenTTSPath, qwenTTSUrl }: QwenTTSWidgetProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    try {
      const response = await fetch('/api/qwen-tts/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: qwenTTSUrl }),
      });
      const data = await response.json();
      setIsRunning(data.success && data.available === true);
    } catch {
      setIsRunning(false);
    } finally {
      setIsChecking(false);
    }
  }, [qwenTTSUrl]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const launchQwenTTS = async () => {
    if (!qwenTTSPath) {
      setError('Qwen3-TTS Pfad nicht konfiguriert');
      return;
    }

    setIsLaunching(true);
    setError(null);

    try {
      const response = await fetch('/api/qwen-tts/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qwenTTSPath }),
      });

      const data = await response.json();

      if (data.success) {
        // Gradio + model loading takes a while, poll frequently
        const pollInterval = setInterval(async () => {
          try {
            const res = await fetch('/api/qwen-tts/health', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: qwenTTSUrl }),
            });
            const d = await res.json();
            if (d.success && d.available === true) {
              setIsRunning(true);
              setIsLaunching(false);
              clearInterval(pollInterval);
            }
          } catch { /* still starting */ }
        }, 5000);

        // Stop polling after 180s (model loading can take long)
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsLaunching(false);
        }, 180000);
      } else {
        setError(data.error || 'Launch failed');
        setIsLaunching(false);
      }
    } catch {
      setError('Failed to launch Qwen3-TTS');
      setIsLaunching(false);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          <span className="font-medium">Qwen3-TTS</span>
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
            <span className="text-green-500">Läuft auf {qwenTTSUrl || 'http://localhost:7861'}</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Nicht gestartet</span>
          </>
        )}
      </div>

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      {!isRunning && !isLaunching && (
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={launchQwenTTS}
          disabled={!qwenTTSPath}
        >
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Starten
        </Button>
      )}

      {!qwenTTSPath && (
        <p className="text-xs text-muted-foreground">
          Konfiguriere den Qwen3-TTS Pfad unten
        </p>
      )}
    </div>
  );
}
