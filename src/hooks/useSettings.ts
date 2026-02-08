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
  
  // Chat Display Settings
  chatLayout: 'linear' | 'bubbles'; // 'linear' = OpenClaw style (default), 'bubbles' = classic
  fontSize: 'small' | 'medium' | 'large'; // Default: 'medium'
  
  // Avatar Settings
  userAvatarType: 'icon' | 'image';    // Default: 'icon'
  userAvatarUrl: string;                // URL or Data-URL for custom image
  aiAvatarType: 'icon' | 'image';      // Default: 'icon' (LocAI Logo)
  aiAvatarUrl: string;                  // URL or Data-URL for custom image
  
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
  chatLayout: 'linear',
  fontSize: 'medium',
  userAvatarType: 'icon',
  userAvatarUrl: '',
  aiAvatarType: 'icon',
  aiAvatarUrl: '',
  dataPath: '',
};

const STORAGE_KEY = 'locai-settings';

export interface UseSettingsReturn {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  isLoaded: boolean;
  saveToFile: () => Promise<boolean>;
  loadFromFile: (dataPath?: string) => Promise<{
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
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Load settings from localStorage and server defaults on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Step 1: Load localStorage settings as baseline
        let localSettings: Partial<AppSettings> = {};
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            localSettings = JSON.parse(stored);
          } catch {
            // Corrupt localStorage, ignore
          }
        }
        
        // Step 2: Always fetch server defaults first (checks ~/.locai/settings.json)
        // This ensures settings survive browser cache clears
        let serverSettings: Partial<AppSettings> = {};
        let serverSource: string | undefined;
        let serverPath: string | null = null;
        
        try {
          const defaultResponse = await fetch('/api/settings');
          const defaultData = await defaultResponse.json();
          if (defaultData.success && defaultData.source === 'file') {
            serverSettings = defaultData.settings || {};
            serverSource = defaultData.source;
            serverPath = defaultData.path;
          }
        } catch {
          // Server unreachable, continue with localStorage only
        }
        
        // Step 3: If server default settings contain a dataPath, load from that path too
        // (the default file at ~/.locai/settings.json might point to a custom data dir)
        const effectiveDataPath = localSettings.dataPath || serverSettings.dataPath;
        if (effectiveDataPath && effectiveDataPath !== '') {
          try {
            const pathResponse = await fetch(`/api/settings?dataPath=${encodeURIComponent(effectiveDataPath)}`);
            const pathData = await pathResponse.json();
            if (pathData.success && pathData.source === 'file') {
              // Settings from the dataPath location take priority
              serverSettings = { ...serverSettings, ...pathData.settings };
              serverSource = pathData.source;
              serverPath = pathData.path;
            }
          } catch {
            // Ignore, use what we have
          }
        }
        
        // Step 4: Merge — server file settings win for paths and important config,
        // localStorage wins for UI preferences that might have been changed locally
        const merged = { ...DEFAULT_SETTINGS, ...serverSettings, ...localSettings };
        
        // But file-based paths should override empty localStorage values
        // (this is the key fix: after cache clear, paths come from file)
        if (serverSource === 'file') {
          const pathKeys: (keyof AppSettings)[] = [
            'dataPath', 'comfyUIPath', 'comfyUIOutputPath', 'notesPath',
            'ollamaHost', 'searxngUrl',
          ];
          for (const key of pathKeys) {
            const serverVal = serverSettings[key];
            const localVal = localSettings[key];
            // File wins if localStorage doesn't have a value for this key
            if (serverVal && (localVal === undefined || localVal === '')) {
              (merged as Record<string, unknown>)[key] = serverVal;
            }
          }
        }
        
        setSettings(merged);
        if (serverPath) {
          setSettingsPath(serverPath);
        }
        
        // Persist merged result back to localStorage so future loads are fast
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        
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
  }, [settings]);
  
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
  
  // Load from specific file (or server default if no path given)
  const loadFromFile = useCallback(async (dataPath?: string): Promise<{
    success: boolean;
    updatedSettings: AppSettings | null;
    source?: 'file' | 'default';
    path?: string | null;
  }> => {
    try {
      const currentSettings = settingsRef.current;
      const targetPath = dataPath || currentSettings.dataPath;
      
      // Build fetch URL — if no path, let the server use its default location
      const fetchUrl = targetPath
        ? `/api/settings?dataPath=${encodeURIComponent(targetPath)}`
        : '/api/settings';
      
      const response = await fetch(fetchUrl);
      const data = await response.json();
      
      if (data.success) {
        const effectivePath = targetPath || data.settings?.dataPath || '';
        setSettings(prev => ({ ...prev, ...data.settings, dataPath: effectivePath }));
        setSettingsPath(data.path);
        return {
          success: true,
          updatedSettings: { ...currentSettings, ...data.settings, dataPath: effectivePath },
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

