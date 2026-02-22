"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface HealthIndicatorProps {
  endpoint: string;
  label: string;
  pollInterval?: number;
}

type HealthState = 'checking' | 'connected' | 'unreachable';

const STATE_CONFIG: Record<HealthState, { dot: string; text: string }> = {
  checking:    { dot: 'bg-yellow-500', text: 'Prüfe...' },
  connected:   { dot: 'bg-emerald-500', text: 'Verbunden' },
  unreachable: { dot: 'bg-red-500', text: 'Nicht erreichbar' },
};

export function HealthIndicator({ endpoint, label, pollInterval = 15000 }: HealthIndicatorProps) {
  const [state, setState] = useState<HealthState>('checking');

  const check = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setState(res.ok ? 'connected' : 'unreachable');
    } catch {
      setState('unreachable');
    }
  }, [endpoint]);

  useEffect(() => {
    check();
    const id = setInterval(check, pollInterval);
    return () => clearInterval(id);
  }, [check, pollInterval]);

  const { dot, text } = STATE_CONFIG[state];

  return (
    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
      <span className={cn('inline-block h-2.5 w-2.5 rounded-full', dot)} />
      <span>{label}: {text}</span>
    </div>
  );
}
