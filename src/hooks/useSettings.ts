"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AppSettings {
  // ComfyUI Settings
  comfyUIPath: string;
  comfyUIPort: number;
  comfyUIAutoStart: boolean;
  comfyUIOutputPath: string; // Absolute path to output folder (for gallery)
  
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
  
  // Web Search Settings (SearXNG)
  searxngUrl: string; // URL to SearXNG instance (e.g., https://searx.example.com or http://localhost:8080)
  searxngEnabled: boolean;
  
  // Data Storage
  dataPath: string; // Local path for storing chats, settings file, etc.
}

const DEFAULT_SETTINGS: AppSettings = {
  comfyUIPath: '',
  comfyUIPort: 8188,
  comfyUIAutoStart: false,
  comfyUIOutputPath: '', // Empty = will use comfyUIPath/ComfyUI/output as default
  ollamaHost: 'http://localhost:11434',
  sidebarWidth: 400,
  theme: 'dark',
  autoSave: true,
  streamingEnabled: true,
  notesPath: '',
  notesEmbeddingModel: 'nomic-embed-text',
  notesAllowAI: true,
  searxngUrl: 'http://localhost:8888', // Local SearXNG Docker instance
  searxngEnabled: true,
  dataPath: '',
};

const STORAGE_KEY = 'locai-settings';

export interface UseSettingsReturn {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  isLoaded: boolean;
  saveToFile: () => Promise<boolean>;
  loadFromFile: (dataPath?: string) => Promise<boolean>;
  settingsPath: string | null;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [settingsPath, setSettingsPath] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // First try localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const mergedSettings = { ...DEFAULT_SETTINGS, ...parsed };
          setSettings(mergedSettings);
          
          // If dataPath is set, also try to load from file
          if (mergedSettings.dataPath) {
            try {
              const response = await fetch(`/api/settings?dataPath=${encodeURIComponent(mergedSettings.dataPath)}`);
              const data = await response.json();
              if (data.success && data.source === 'file') {
                setSettings(prev => ({ ...prev, ...data.settings }));
                setSettingsPath(data.path);
              }
            } catch {
              // Ignore file errors, use localStorage
            }
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
      setIsLoaded(true);
    };
    
    loadSettings();
  }, []);

  // Save settings to localStorage and optionally to file (debounced)
  useEffect(() => {
    if (!isLoaded) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Always save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        
        // If dataPath is set, also save to file
        if (settings.dataPath) {
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
          } catch {
            console.error('Failed to save settings to file');
          }
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
    localStorage.removeItem(STORAGE_KEY);
    setSettingsPath(null);
    
    // Also delete file if exists
    if (settings.dataPath) {
      try {
        await fetch(`/api/settings?dataPath=${encodeURIComponent(settings.dataPath)}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore
      }
    }
  }, [settings.dataPath]);
  
  // Manual save to file
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
  
  // Load from specific file
  const loadFromFile = useCallback(async (dataPath?: string): Promise<boolean> => {
    try {
      const path = dataPath || settings.dataPath;
      if (!path) return false;
      
      const response = await fetch(`/api/settings?dataPath=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.success) {
        setSettings(prev => ({ ...prev, ...data.settings, dataPath: path }));
        setSettingsPath(data.path);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [settings.dataPath]);

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

