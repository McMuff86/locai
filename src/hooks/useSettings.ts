"use client";

import { useState, useEffect, useCallback } from 'react';

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
};

const STORAGE_KEY = 'locai-settings';

export interface UseSettingsReturn {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  isLoaded: boolean;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }
  }, [settings, isLoaded]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
  };
}

export default useSettings;

