"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Download, FolderDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractFilename } from '@/lib/audio-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Props for the {@link SaveMenu} component. */
interface SaveMenuProps {
  src: string;
  filename?: string;
  compact?: boolean;
  /** Style variant: 'icon' shows just an icon button, 'label' shows text label */
  variant?: 'icon' | 'label';
}

/**
 * Dropdown menu offering "Save as…" (browser download) and
 * "Save to workspace" (persists the file server-side via API).
 */
export function SaveMenu({ src, filename, compact = false, variant = 'icon' }: SaveMenuProps) {
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);
  const [saving, setSaving] = useState(false);

  const handleSaveToWorkspace = useCallback(async () => {
    const fname = filename || extractFilename(src);
    setSaving(true);
    try {
      const res = await fetch('/api/audio-files/save-to-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fname }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [src, filename]);

  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'label' ? (
          <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30">
            <Download className="h-3 w-3" />
            Speichern
          </button>
        ) : (
          <button className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <Download className={iconSize} />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem asChild>
          <a href={src} download className="flex items-center gap-2 cursor-pointer">
            <Download className="h-4 w-4" />
            Speichern unter...
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSaveToWorkspace}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saved ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <FolderDown className="h-4 w-4" />
          )}
          {saving ? 'Speichere...' : saved ? 'Gespeichert!' : 'Im Workspace speichern'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
