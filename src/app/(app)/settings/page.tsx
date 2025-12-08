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
  Monitor,
  HardDrive,
  Upload,
  Download,
  CheckCircle2,
  Globe,
  ExternalLink
} from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, saveToFile, loadFromFile, settingsPath } = useSettings();
  const { theme, setTheme } = useTheme();
  const [isPickingFolder, setIsPickingFolder] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pickFolder = async (type: 'comfyPath' | 'outputPath' | 'notesPath' | 'dataPath') => {
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
          } else if (type === 'dataPath') {
            updateSettings({ dataPath: path });
            // Try to load settings from the new path
            await loadFromFile(path);
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

        {/* Web Search (SearXNG) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5 text-primary" />
            Web-Suche (SearXNG)
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Web-Suche aktivieren</div>
                <div className="text-sm text-muted-foreground">
                  Zeigt einen 🌐 Button im Chat für Web-Suche an
                </div>
              </div>
              <Button
                variant={settings?.searxngEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  updateSettings({ searxngEnabled: !settings?.searxngEnabled });
                  showSaved();
                }}
              >
                {settings?.searxngEnabled ? 'Aktiviert' : 'Deaktiviert'}
              </Button>
            </div>

            <div>
              <label className="block font-medium mb-1">Bevorzugte SearXNG-Instanz (optional)</label>
              <p className="text-sm text-muted-foreground mb-2">
                Falls leer, werden automatisch öffentliche Instanzen mit Fallback verwendet.
                <a 
                  href="https://searx.space/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline ml-1"
                >
                  Instanzen-Liste
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <Input
                value={settings?.searxngUrl || ''}
                onChange={(e) => handleInputChange('searxngUrl', e.target.value)}
                placeholder="Optional - z.B. http://localhost:8080"
              />
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded space-y-1">
              <p>✨ <strong>Auto-Fallback:</strong> Falls eine Instanz fehlschlägt, werden automatisch andere versucht.</p>
              <p>🔒 <strong>Privatsphäre:</strong> SearXNG ist eine Meta-Suchmaschine ohne Tracking.</p>
              <p>🐳 <strong>Eigene Instanz:</strong> <code className="bg-background px-1 rounded">docker run -p 8080:8080 searxng/searxng</code></p>
            </div>
          </div>
        </section>

        {/* Data Storage */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <HardDrive className="h-5 w-5 text-primary" />
            Datenspeicher
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div>
              <label className="block font-medium mb-1">Lokaler Datenpfad</label>
              <p className="text-sm text-muted-foreground mb-2">
                Optionaler Pfad für persistente Einstellungen. Wenn gesetzt, werden Settings in einer Datei gespeichert und können nach Rebuilds wiederhergestellt werden.
              </p>
              <div className="flex gap-2">
                <Input
                  value={settings?.dataPath || ''}
                  onChange={(e) => handleInputChange('dataPath', e.target.value)}
                  placeholder="C:\LocAI-Data"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => pickFolder('dataPath')}
                  disabled={isPickingFolder === 'dataPath'}
                >
                  {isPickingFolder === 'dataPath' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {settingsPath && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Gespeichert in: {settingsPath}
                </p>
              )}
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const success = await saveToFile();
                  if (success) showSaved();
                }}
                disabled={!settings?.dataPath}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                In Datei speichern
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const success = await loadFromFile();
                  if (success) showSaved();
                }}
                disabled={!settings?.dataPath}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Aus Datei laden
              </Button>
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

