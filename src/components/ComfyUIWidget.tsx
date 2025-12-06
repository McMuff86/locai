"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { 
  Paintbrush, 
  Play, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  RefreshCw
} from 'lucide-react';

interface ComfyUIWidgetProps {
  comfyUIPath: string;
  comfyUIPort: number;
  onOpenSettings?: () => void;
  compact?: boolean;
}

interface ComfyUIStatus {
  running: boolean;
  port: number;
  host: string;
  systemStats?: {
    system?: {
      vram_total?: number;
      vram_free?: number;
    };
  };
}

export function ComfyUIWidget({ 
  comfyUIPath, 
  comfyUIPort,
  onOpenSettings,
  compact = false 
}: ComfyUIWidgetProps) {
  const [status, setStatus] = useState<ComfyUIStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check ComfyUI status
  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/comfyui/status?port=${comfyUIPort}`);
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError('Failed to check status');
      setStatus({ running: false, port: comfyUIPort, host: 'localhost' });
    } finally {
      setIsChecking(false);
    }
  }, [comfyUIPort]);

  // Check status on mount and periodically
  useEffect(() => {
    checkStatus();
    
    // Poll every 10 seconds
    const interval = setInterval(checkStatus, 10000);
    
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Launch ComfyUI
  const launchComfyUI = async () => {
    if (!comfyUIPath) {
      setError('ComfyUI Pfad nicht konfiguriert');
      onOpenSettings?.();
      return;
    }

    setIsLaunching(true);
    setError(null);

    try {
      const response = await fetch('/api/comfyui/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comfyUIPath }),
      });

      const data = await response.json();

      if (data.success) {
        // Wait a bit then check status
        setTimeout(() => {
          checkStatus();
        }, 3000);
      } else {
        setError(data.error || 'Launch failed');
      }
    } catch (err) {
      setError('Failed to launch ComfyUI');
    } finally {
      setIsLaunching(false);
    }
  };

  // Open ComfyUI in browser - use named window to reuse existing tab
  const openComfyUI = () => {
    // Using a named window target - if a window with this name exists, it will be focused
    // instead of opening a new tab
    window.open(`http://localhost:${comfyUIPort}`, 'comfyui-window');
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
        <Paintbrush className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">ComfyUI</span>
        
        <div className="ml-auto flex items-center gap-1">
          {isChecking ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : status?.running ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={openComfyUI}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={launchComfyUI}
                disabled={isLaunching || !comfyUIPath}
              >
                {isLaunching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-muted/30 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paintbrush className="h-5 w-5 text-primary" />
          <span className="font-medium">ComfyUI</span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={checkStatus}
          disabled={isChecking}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        {isChecking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Checking...</span>
          </>
        ) : status?.running ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-green-500">Running on port {status.port}</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Not running</span>
          </>
        )}
      </div>

      {/* VRAM Info (if running) */}
      {status?.running && status.systemStats?.system && (
        <div className="text-xs text-muted-foreground">
          VRAM: {((status.systemStats.system.vram_total || 0) - (status.systemStats.system.vram_free || 0) / 1024 / 1024 / 1024).toFixed(1)} / 
          {((status.systemStats.system.vram_total || 0) / 1024 / 1024 / 1024).toFixed(1)} GB
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {status?.running ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={openComfyUI}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Öffnen
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={launchComfyUI}
            disabled={isLaunching || !comfyUIPath}
          >
            {isLaunching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Startet...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Starten
              </>
            )}
          </Button>
        )}
      </div>

      {/* Path hint */}
      {!comfyUIPath && (
        <p className="text-xs text-muted-foreground">
          Konfiguriere den ComfyUI Pfad in den Einstellungen
        </p>
      )}
    </div>
  );
}

export default ComfyUIWidget;

