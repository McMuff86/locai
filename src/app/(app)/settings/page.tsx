"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from 'next-themes';
import { OllamaStatus } from '@/components/OllamaStatus';
import { ComfyUIWidget } from '@/components/ComfyUIWidget';
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
  ExternalLink,
  AlertCircle,
  Database,
  Cpu,
  Trash2,
  Activity,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SystemStats {
  cpu: { model: string; cores: number; usage: number };
  memory: { total: number; used: number; free: number; usagePercent: number };
  gpu?: {
    available: boolean;
    name: string;
    driver: string;
    vram: { total: number; used: number; free: number; usagePercent: number };
    utilization: number;
    temperature: number;
    power: { current: number; limit: number };
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, saveToFile, loadFromFile, settingsPath } = useSettings();
  const { theme, setTheme } = useTheme();
  const [isPickingFolder, setIsPickingFolder] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── System Stats ───────────────────────────────────────────────────────
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const fetchSystemStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const ollamaHost = settings?.ollamaHost || 'http://localhost:11434';
      const res = await fetch(`/api/system-stats?ollamaHost=${encodeURIComponent(ollamaHost)}`);
      if (res.ok) {
        const data = await res.json();
        setSystemStats(data);
      }
    } catch {
      // Silently ignore – stats are optional
    } finally {
      setIsLoadingStats(false);
    }
  }, [settings?.ollamaHost]);

  useEffect(() => {
    fetchSystemStats();
    const interval = setInterval(fetchSystemStats, 15000);
    return () => clearInterval(interval);
  }, [fetchSystemStats]);

  // ── Import / Export (browser‑side, same as chat page) ──────────────────

  const handleExportConversations = useCallback(async () => {
    try {
      const stored = localStorage.getItem('locai-conversations');
      if (!stored) {
        showStatus('error', 'Keine Konversationen zum Exportieren gefunden.');
        return;
      }
      const blob = new Blob([stored], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `locai-conversations-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('success', 'Konversationen erfolgreich exportiert.');
    } catch {
      showStatus('error', 'Export fehlgeschlagen.');
    }
  }, []);

  const handleImportConversations = useCallback(async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          const existing = localStorage.getItem('locai-conversations');
          const existingArr = existing ? JSON.parse(existing) : [];
          const merged = [...existingArr, ...(Array.isArray(parsed) ? parsed : [parsed])];
          localStorage.setItem('locai-conversations', JSON.stringify(merged));
          showStatus('success', `${Array.isArray(parsed) ? parsed.length : 1} Konversation(en) importiert. Seite wird neu geladen…`);
          setTimeout(() => window.location.reload(), 1500);
        } catch {
          showStatus('error', 'Ungültige JSON-Datei.');
        }
      };
      input.click();
    } catch {
      showStatus('error', 'Import fehlgeschlagen.');
    }
  }, []);

  const handleClearAllConversations = useCallback(() => {
    if (window.confirm('Sind Sie sicher, dass Sie ALLE gespeicherten Konversationen löschen möchten? Dies kann nicht rückgängig gemacht werden.')) {
      localStorage.removeItem('locai-conversations');
      showStatus('success', 'Alle Konversationen wurden gelöscht. Seite wird neu geladen…');
      setTimeout(() => window.location.reload(), 1500);
    }
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────

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

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 2500);
  };

  const handleInputChange = (key: string, value: string) => {
    updateSettings({ [key]: value });
    showSaved();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // ─── Render ────────────────────────────────────────────────────────────

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

        {/* ────────────── Appearance ────────────── */}
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

        {/* ────────────── Ollama ────────────── */}
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
            {/* Inline Ollama Status */}
            <div>
              <label className="block font-medium mb-2">Verbindungsstatus</label>
              <OllamaStatus showVersion compact={false} host={settings?.ollamaHost} />
            </div>
          </div>
        </section>

        {/* ────────────── ComfyUI Configuration ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Image className="h-5 w-5 text-primary" />
            ComfyUI
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            {/* Live Widget */}
            {settings && (
              <ComfyUIWidget
                comfyUIPath={settings.comfyUIPath}
                comfyUIPort={settings.comfyUIPort}
              />
            )}

            <div className="border-t border-border pt-4">
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

        {/* ────────────── Notes ────────────── */}
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

        {/* ────────────── Web Search (SearXNG) ────────────── */}
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

        {/* ────────────── Data Management (NEW) ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5 text-primary" />
            Datenverwaltung
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Importiere, exportiere oder lösche deine Konversationen.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={handleImportConversations}
              >
                <Upload className="h-4 w-4" />
                Chats importieren
              </Button>
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={handleExportConversations}
              >
                <Download className="h-4 w-4" />
                Chats exportieren
              </Button>
              <Button
                variant="outline"
                className="gap-2 justify-start text-destructive hover:text-destructive"
                onClick={handleClearAllConversations}
              >
                <Trash2 className="h-4 w-4" />
                Alle löschen
              </Button>
            </div>

            {/* Status feedback for import/export/clear */}
            {status && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  status.type === 'success' ? 'text-emerald-500' : 'text-destructive'
                }`}
              >
                {status.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {status.message}
              </div>
            )}
          </div>
        </section>

        {/* ────────────── Data Storage ────────────── */}
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
                  if (success) {
                    showSaved();
                    showStatus('success', 'Einstellungen wurden gespeichert.');
                  } else {
                    showStatus('error', 'Speichern in Datei fehlgeschlagen.');
                  }
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
                  const before = JSON.stringify(settings);
                  const result = await loadFromFile();
                  if (result.success) {
                    showSaved();
                    const after = JSON.stringify(result.updatedSettings ?? settings);
                    const changed = before !== after;
                    const loadedNotesPath = result.updatedSettings?.notesPath;
                    const noteInfo = loadedNotesPath
                      ? `notesPath: ${loadedNotesPath}`
                      : 'notesPath nicht gesetzt';
                    showStatus(
                      'success',
                      changed
                        ? `Einstellungen aus Datei geladen (${noteInfo}).`
                        : `Keine Änderungen (Datei entspricht aktuellem Stand, ${noteInfo}).`
                    );
                  } else {
                    showStatus('error', 'Konnte Datei nicht laden (Pfad/JSON prüfen).');
                  }
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

        {/* ────────────── System Info (NEW) ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-primary" />
            System Info
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            {isLoadingStats && !systemStats ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lade Systeminformationen…
              </div>
            ) : systemStats ? (
              <>
                {/* CPU */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    CPU
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs">Modell</div>
                      <div className="font-medium truncate">{systemStats.cpu.model}</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs">Kerne / Auslastung</div>
                      <div className="font-medium">
                        {systemStats.cpu.cores} Kerne · {systemStats.cpu.usage.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* RAM */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">RAM</h4>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">
                        {systemStats.memory.used.toFixed(1)} GB / {systemStats.memory.total.toFixed(1)} GB
                      </span>
                      <span className="font-medium">
                        {systemStats.memory.usagePercent.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${systemStats.memory.usagePercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* GPU */}
                {systemStats.gpu?.available && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">GPU</h4>
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{systemStats.gpu.name}</span>
                        <span className="text-muted-foreground">{systemStats.gpu.temperature}°C</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>VRAM: {systemStats.gpu.vram.used.toFixed(1)} GB / {systemStats.gpu.vram.total.toFixed(1)} GB</span>
                          <span>{systemStats.gpu.utilization}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${systemStats.gpu.vram.usagePercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={fetchSystemStats}
                  disabled={isLoadingStats}
                >
                  {isLoadingStats ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Activity className="h-3 w-3" />
                  )}
                  Aktualisieren
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Systeminformationen nicht verfügbar.
              </p>
            )}
          </div>
        </section>

        {/* ────────────── Reset ────────────── */}
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
