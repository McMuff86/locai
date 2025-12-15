"use client";

import { useState, useEffect, useCallback } from 'react';

export interface OllamaStatus {
  isConnected: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  error: string | null;
  version?: string;
}

const CHECK_INTERVAL = 10000; // Check every 10 seconds

function sanitizeHost(host: string): string {
  return host.replace(/\/$/, '');
}

export function useOllamaStatus(host?: string) {
  const baseUrl = sanitizeHost(
    host || process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434'
  );

  const [status, setStatus] = useState<OllamaStatus>({
    isConnected: false,
    isChecking: true,
    lastChecked: null,
    error: null,
  });

  const checkConnection = useCallback(async () => {
    setStatus(prev => ({ ...prev, isChecking: true }));
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${baseUrl}/api/version`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setStatus({
          isConnected: true,
          isChecking: false,
          lastChecked: new Date(),
          error: null,
          version: data.version,
        });
      } else {
        setStatus({
          isConnected: false,
          isChecking: false,
          lastChecked: new Date(),
          error: `HTTP ${response.status}`,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.name === 'AbortError' 
          ? 'Timeout - Ollama antwortet nicht'
          : err.message
        : 'Verbindungsfehler';
      
      setStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date(),
        error: errorMessage,
      });
    }
  }, [baseUrl]);

  // Initial check
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Periodic check
  useEffect(() => {
    const interval = setInterval(checkConnection, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkConnection]);

  // Check on window focus
  useEffect(() => {
    const handleFocus = () => {
      checkConnection();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkConnection]);

  return {
    ...status,
    refresh: checkConnection,
  };
}

export default useOllamaStatus;
