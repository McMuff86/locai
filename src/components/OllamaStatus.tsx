"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Button } from './ui/button';
import { useOllamaStatus } from '../hooks/useOllamaStatus';

interface OllamaStatusProps {
  showVersion?: boolean;
  compact?: boolean;
  className?: string;
}

export function OllamaStatus({ 
  showVersion = false, 
  compact = false,
  className = '' 
}: OllamaStatusProps) {
  const { isConnected, isChecking, error, version, refresh } = useOllamaStatus();

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {isChecking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : isConnected ? (
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            {showVersion && version && (
              <span className="text-xs text-muted-foreground">v{version}</span>
            )}
          </div>
        ) : (
          <button
            onClick={refresh}
            className="flex items-center gap-1 text-destructive hover:text-destructive/80"
            title={error || 'Ollama nicht verbunden'}
          >
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
            </span>
            <span className="text-xs">Offline</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-3 ${className} ${
      isConnected 
        ? 'border-green-500/30 bg-green-500/5' 
        : 'border-destructive/30 bg-destructive/5'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isConnected ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Ollama {isConnected ? 'Verbunden' : 'Nicht verbunden'}
              </span>
              {isConnected && showVersion && version && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  v{version}
                </span>
              )}
            </div>
            {!isConnected && error && (
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            )}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isChecking}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {!isConnected && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-border"
          >
            <p className="text-xs text-muted-foreground mb-2">
              Starte Ollama mit folgendem Befehl:
            </p>
            <code className="block text-xs bg-muted p-2 rounded font-mono">
              ollama serve
            </code>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// Inline status for header/footer
export function OllamaStatusInline({ className = '' }: { className?: string }) {
  const { isConnected, isChecking, refresh } = useOllamaStatus();
  
  return (
    <button
      onClick={refresh}
      disabled={isChecking}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${className} ${
        isConnected 
          ? 'text-green-600 hover:bg-green-500/10' 
          : 'text-destructive hover:bg-destructive/10'
      }`}
      title={isConnected ? 'Ollama verbunden' : 'Ollama nicht verbunden - Klicken zum Aktualisieren'}
    >
      {isChecking ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isConnected ? (
        <Wifi className="h-3.5 w-3.5" />
      ) : (
        <WifiOff className="h-3.5 w-3.5" />
      )}
      <span className="text-xs font-medium">
        {isChecking ? '...' : isConnected ? 'Online' : 'Offline'}
      </span>
    </button>
  );
}

export default OllamaStatus;

