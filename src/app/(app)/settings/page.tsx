"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from 'next-themes';
import { 
  FolderOpen, 
  Loader2, 
  Moon, 
  Sun, 
  Save,
  RotateCcw,
  Server,
  Image,
  FileText,
  Monitor
} from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const [isPickingFolder, setIsPickingFolder] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pickFolder = async (type: 'comfyPath' | 'outputPath' | 'notesPath') => {
    setIsPickingFolder(type);
    try {
      const response = await fetch('/api/folder-picker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialPath: '' }),
      });
      
      if (response.ok) {
        const { path } = await response.json();
        if (path) {
          if (type === 'comfyPath') {
            updateSettings({ comfyUIPath: path });
          } else if (type === 'outputPath') {
            updateSettings({ comfyUIOutputPath: path });
          } else {
            updateSettings({ notesPath: path });
          }
          showSaved();
        }
      }
    } catch (error) {
      console.error('Error picking folder:', error);
    } finally {
      setIsPickingFolder(null);
    }
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleInputChange = (key: string, value: string) => {
    updateSettings({ [key]: value });
    showSaved();
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Einstellungen</h1>
            <p className="text-muted-foreground">Konfiguriere LocAI nach deinen Wünschen</p>
          </div>
          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <Save className="h-4 w-4" />
              Gespeichert
            </div>
          )}
        </div>

        {/* Appearance */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Monitor className="h-5 w-5 text-primary" />
            Erscheinungsbild
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Theme</div>
                <div className="text-sm text-muted-foreground">Wähle zwischen Hell und Dunkel</div>
              </div>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <Button
                  variant={theme === 'light' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="gap-2"
                >
                  <Sun className="h-4 w-4" />
                  Hell
                </Button>
                <Button
                  variant={theme === 'dark' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="gap-2"
                >
                  <Moon className="h-4 w-4" />
                  Dunkel
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Ollama Settings */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Server className="h-5 w-5 text-primary" />
            Ollama
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div>
              <label className="block font-medium mb-1">Ollama Host</label>
              <p className="text-sm text-muted-foreground mb-2">Die URL deines Ollama Servers</p>
              <Input
                value={settings?.ollamaHost || 'http://localhost:11434'}
                onChange={(e) => handleInputChange('ollamaHost', e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
          </div>
        </section>

        {/* ComfyUI Settings */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Image className="h-5 w-5 text-primary" />
            ComfyUI
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div>
              <label className="block font-medium mb-1">ComfyUI Installationspfad</label>
              <p className="text-sm text-muted-foreground mb-2">Pfad zur ComfyUI Installation</p>
              <div className="flex gap-2">
                <Input
                  value={settings?.comfyUIPath || ''}
                  onChange={(e) => handleInputChange('comfyUIPath', e.target.value)}
                  placeholder="C:\ComfyUI"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => pickFolder('comfyPath')}
                  disabled={isPickingFolder === 'comfyPath'}
                >
                  {isPickingFolder === 'comfyPath' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">Output Pfad</label>
              <p className="text-sm text-muted-foreground mb-2">Pfad zu den generierten Bildern</p>
              <div className="flex gap-2">
                <Input
                  value={settings?.comfyUIOutputPath || ''}
                  onChange={(e) => handleInputChange('comfyUIOutputPath', e.target.value)}
                  placeholder="C:\ComfyUI\output"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => pickFolder('outputPath')}
                  disabled={isPickingFolder === 'outputPath'}
                >
                  {isPickingFolder === 'outputPath' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">ComfyUI Port</label>
              <p className="text-sm text-muted-foreground mb-2">Port auf dem ComfyUI läuft</p>
              <Input
                type="number"
                value={settings?.comfyUIPort || 8188}
                onChange={(e) => handleInputChange('comfyUIPort', e.target.value)}
                placeholder="8188"
                className="w-32"
              />
            </div>
          </div>
        </section>

        {/* Notes Settings */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5 text-primary" />
            Notizen
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div>
              <label className="block font-medium mb-1">Notizen Pfad</label>
              <p className="text-sm text-muted-foreground mb-2">Pfad zu deinen Markdown-Notizen</p>
              <div className="flex gap-2">
                <Input
                  value={settings?.notesPath || ''}
                  onChange={(e) => handleInputChange('notesPath', e.target.value)}
                  placeholder="C:\Notes"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => pickFolder('notesPath')}
                  disabled={isPickingFolder === 'notesPath'}
                >
                  {isPickingFolder === 'notesPath' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">Embedding Modell</label>
              <p className="text-sm text-muted-foreground mb-2">Modell für semantische Suche</p>
              <Input
                value={settings?.notesEmbeddingModel || 'nomic-embed-text'}
                onChange={(e) => handleInputChange('notesEmbeddingModel', e.target.value)}
                placeholder="nomic-embed-text"
              />
            </div>
          </div>
        </section>

        {/* Reset */}
        <section className="pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Alle Einstellungen zurücksetzen?')) {
                resetSettings();
                showSaved();
              }
            }}
            className="text-destructive hover:text-destructive"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Einstellungen zurücksetzen
          </Button>
        </section>
      </div>
    </div>
  );
}

