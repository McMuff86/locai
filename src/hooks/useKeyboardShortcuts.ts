"use client";

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when typing in input/textarea (except specific ones)
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;
    
    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      
      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        // For Escape, always trigger. For others, check if in input
        if (shortcut.key.toLowerCase() === 'escape' || !isInputField || shortcut.ctrl || shortcut.meta) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
}

// Pre-defined common shortcuts
export const commonShortcuts = {
  newChat: { key: 'n', ctrl: true, description: 'New conversation' },
  save: { key: 's', ctrl: true, description: 'Save conversation' },
  escape: { key: 'Escape', description: 'Stop/Cancel' },
  focusInput: { key: '/', description: 'Focus chat input' },
  toggleSidebar: { key: 'b', ctrl: true, description: 'Toggle sidebar' },
};

export default useKeyboardShortcuts;

