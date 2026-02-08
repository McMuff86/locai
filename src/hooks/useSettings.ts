"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AppSettings {
  // ComfyUI Settings
  comfyUIPath: string;
  comfyUIPort: number;
  comfyUIAutoStart: boolean;
  comfyUIOutputPath: string;

  // Ollama Settings
  ollamaHost: string;

  // UI Settings
  sidebarWidth: number;
  theme: 'light' | 'dark' | 'system';

  // Chat Settings
  autoSave: boolean;
  streamingEnabled: boolean;

  // Notes Settings
  notesPath: string;
  notesEmbeddingModel: string;
  notesAllowAI: boolean;

  // Agent Settings
  agentWorkspacePath: string;

  // Web Search Settings (SearXNG)
  searxngUrl: string;
  searxngEnabled: boolean;

  // Chat Display Settings
  chatLayout: 'linear' | 'bubbles';
  fontSize: 'small' | 'medium' | 'large';

  // Avatar Settings
  userAvatarType: 'icon' | 'image';
  userAvatarUrl: string;
  aiAvatarType: 'icon' | 'image';
  aiAvatarUrl: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  comfyUIPath: '',
  comfyUIPort: 8188,
  comfyUIAutoStart: false,
  comfyUIOutputPath: '',
  ollamaHost: 'http://localhost:11434',
  sidebarWidth: 400,
  theme: 'dark',
  autoSave: true,
  streamingEnabled: true,
  notesPath: '',
  notesEmbeddingModel: 'nomic-embed-text',
  notesAllowAI: true,
  agentWorkspacePath: '',
  searxngUrl: 'http://localhost:8888',
  searxngEnabled: true,
  chatLayout: 'linear',
  fontSize: 'medium',
  userAvatarType: 'icon',
  userAvatarUrl: '',
  aiAvatarType: 'icon',
  aiAvatarUrl: '',
};

export interface UseSettingsReturn {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  isLoaded: boolean;
  saveToFile: () => Promise<boolean>;
  loadFromFile: () => Promise<{
    success: boolean;
    updatedSettings: AppSettings | null;
    source?: 'file' | 'default';
    path?: string | null;
  }>;
  settingsPath: string | null;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [settingsPath, setSettingsPath] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings from server on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (data.success) {
          const merged = { ...DEFAULT_SETTINGS, ...data.settings };
          setSettings(merged);
          setSettingsPath(data.path ?? null);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
      setIsLoaded(true);
    };

    loadSettings();
  }, []);

  // Save settings to file (debounced)
  useEffect(() => {
    if (!isLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        });
        const data = await response.json();
        if (data.success) {
          setSettingsPath(data.path);
        }
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings, isLoaded]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    setSettingsPath(null);

    try {
      await fetch('/api/settings', { method: 'DELETE' });
    } catch {
      // Ignore
    }
  }, []);

  const saveToFile = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();
      if (data.success) {
        setSettingsPath(data.path);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [settings]);

  const loadFromFile = useCallback(async (): Promise<{
    success: boolean;
    updatedSettings: AppSettings | null;
    source?: 'file' | 'default';
    path?: string | null;
  }> => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (data.success) {
        const merged = { ...DEFAULT_SETTINGS, ...data.settings };
        setSettings(merged);
        setSettingsPath(data.path);
        return {
          success: true,
          updatedSettings: merged,
          source: data.source,
          path: data.path,
        };
      }
      return { success: false, updatedSettings: null };
    } catch {
      return { success: false, updatedSettings: null };
    }
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
    saveToFile,
    loadFromFile,
    settingsPath,
  };
}

export default useSettings;
