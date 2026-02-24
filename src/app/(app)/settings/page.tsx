"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  MessageSquare,
  Type,
  User,
  X,
  Zap,
  Key,
  Music,
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { HealthIndicator } from '@/components/HealthIndicator';
import { ProviderHealthWidget } from '@/components/providers/ProviderHealthWidget';
import { FallbackSettings } from '@/components/providers/FallbackSettings';
import { ChatAvatar } from '@/components/chat/ChatAvatar';
import {
  loadProviderSettings,
  saveProviderSettings,
  type ProviderSettings,
  type ProviderType,
} from '@/lib/providers';

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
  const { settings, updateSettings, resetSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const [isPickingFolder, setIsPickingFolder] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importConfirm, setImportConfirm] = useState<{ file: File; show: boolean } | null>(null);

  // ── Provider Settings ───────────────────────────────────────────────────
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(loadProviderSettings);
  const handleProviderToggle = useCallback((type: ProviderType, enabled: boolean) => {
    setProviderSettings((prev) => {
      const next = {
        ...prev,
        providers: {
          ...prev.providers,
          [type]: { ...prev.providers[type], enabled },
        },
      };
      saveProviderSettings(next);
      return next;
    });
  }, []);
  const handleProviderApiKey = useCallback((type: ProviderType, apiKey: string) => {
    setProviderSettings((prev) => {
      const next = {
        ...prev,
        providers: {
          ...prev.providers,
          [type]: { ...prev.providers[type], apiKey, enabled: apiKey.length > 0 },
        },
      };
      saveProviderSettings(next);
      return next;
    });
  }, []);

  // ── Server-configured providers ─────────────────────────────────────
  const [serverProviders, setServerProviders] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/models')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.providers) setServerProviders(data.providers as string[]);
      })
      .catch(() => {});
  }, []);

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

  // ── Full Backup / Restore ────────────────────────────────────────────

  const handleExportBackup = useCallback(async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/backup/export');
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Export fehlgeschlagen' }));
        showStatus('error', data.error || 'Export fehlgeschlagen');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="(.+)"/);
      a.download = match?.[1] || `locai-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('success', 'Backup erfolgreich exportiert.');
    } catch {
      showStatus('error', 'Backup-Export fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImportBackup = useCallback(async (file: File) => {
    setIsImporting(true);
    setImportConfirm(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/backup/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        showStatus('success', `Backup wiederhergestellt: ${data.restoredCount} Dateien importiert.`);
      } else {
        showStatus('error', data.error || 'Import fehlgeschlagen');
      }
    } catch {
      showStatus('error', 'Backup-Import fehlgeschlagen.');
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleImportBackupClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImportConfirm({ file, show: true });
    };
    input.click();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────

  const pickFolder = async (type: 'comfyPath' | 'outputPath' | 'notesPath' | 'agentWorkspace' | 'aceStepPath') => {
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
          } else if (type === 'agentWorkspace') {
            updateSettings({ agentWorkspacePath: path });
          } else if (type === 'aceStepPath') {
            updateSettings({ aceStepPath: path });
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

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const showSaved = () => {
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatus(null), 2500);
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

        {/* ────────────── Provider Status ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-primary" />
            Provider Status
          </div>
          <ProviderHealthWidget />
        </section>

        {/* ────────────── Automatic Fallback ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-primary" />
            Automatic Fallback
          </div>
          <FallbackSettings />
        </section>

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

        {/* ────────────── Chat Display ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="h-5 w-5 text-primary" />
            Chat Darstellung
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            {/* Chat Layout */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Chat Layout</div>
                <div className="text-sm text-muted-foreground">Wähle zwischen linearem und Bubble-Stil</div>
              </div>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <Button
                  variant={settings?.chatLayout === 'linear' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    updateSettings({ chatLayout: 'linear' });
                    showSaved();
                  }}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Linear
                </Button>
                <Button
                  variant={settings?.chatLayout === 'bubbles' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    updateSettings({ chatLayout: 'bubbles' });
                    showSaved();
                  }}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Bubbles
                </Button>
              </div>
            </div>

            {/* Font Size */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Schriftgrösse</div>
                <div className="text-sm text-muted-foreground">Globale Textgrösse anpassen</div>
              </div>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <Button
                  variant={settings?.fontSize === 'small' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    updateSettings({ fontSize: 'small' });
                    showSaved();
                  }}
                >
                  <Type className="h-3 w-3" />
                </Button>
                <Button
                  variant={settings?.fontSize === 'medium' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    updateSettings({ fontSize: 'medium' });
                    showSaved();
                  }}
                >
                  <Type className="h-4 w-4" />
                </Button>
                <Button
                  variant={settings?.fontSize === 'large' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    updateSettings({ fontSize: 'large' });
                    showSaved();
                  }}
                >
                  <Type className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ────────────── Avatare ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <User className="h-5 w-5 text-primary" />
            Avatare
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-6">
            {/* AI Avatar */}
            <div className="space-y-3">
              <div className="font-medium">AI Avatar</div>
              <div className="flex items-center gap-4">
                <ChatAvatar type="ai" size={48} />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2 bg-muted rounded-lg p-1 w-fit">
                    <Button
                      variant={settings?.aiAvatarType === 'icon' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        updateSettings({ aiAvatarType: 'icon' });
                        showSaved();
                      }}
                    >
                      LocAI Logo
                    </Button>
                    <Button
                      variant={settings?.aiAvatarType === 'image' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        updateSettings({ aiAvatarType: 'image' });
                        showSaved();
                      }}
                    >
                      Bild
                    </Button>
                  </div>
                  {settings?.aiAvatarType === 'image' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.png,.jpg,.jpeg,.svg,.webp';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              showStatus('error', 'Bild zu gross (max. 5MB).');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target?.result as string;
                              updateSettings({ aiAvatarUrl: dataUrl });
                              showSaved();
                            };
                            reader.readAsDataURL(file);
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4" />
                        Bild hochladen
                      </Button>
                      {settings?.aiAvatarUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => {
                            updateSettings({ aiAvatarType: 'icon', aiAvatarUrl: '' });
                            showSaved();
                          }}
                        >
                          <X className="h-4 w-4" />
                          Zurücksetzen
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* User Avatar */}
            <div className="space-y-3">
              <div className="font-medium">User Avatar</div>
              <div className="flex items-center gap-4">
                <ChatAvatar type="user" size={48} />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2 bg-muted rounded-lg p-1 w-fit">
                    <Button
                      variant={settings?.userAvatarType === 'icon' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        updateSettings({ userAvatarType: 'icon' });
                        showSaved();
                      }}
                    >
                      Standard-Icon
                    </Button>
                    <Button
                      variant={settings?.userAvatarType === 'image' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        updateSettings({ userAvatarType: 'image' });
                        showSaved();
                      }}
                    >
                      Bild
                    </Button>
                  </div>
                  {settings?.userAvatarType === 'image' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.png,.jpg,.jpeg,.svg,.webp';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              showStatus('error', 'Bild zu gross (max. 5MB).');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target?.result as string;
                              updateSettings({ userAvatarUrl: dataUrl });
                              showSaved();
                            };
                            reader.readAsDataURL(file);
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4" />
                        Bild hochladen
                      </Button>
                      {settings?.userAvatarUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => {
                            updateSettings({ userAvatarType: 'icon', userAvatarUrl: '' });
                            showSaved();
                          }}
                        >
                          <X className="h-4 w-4" />
                          Zurücksetzen
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              💡 Bilder werden lokal als Base64 gespeichert. Max. Dateigrösse: 5MB.
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

        {/* ────────────── AI Providers ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Key className="h-5 w-5 text-primary" />
            AI Providers (Flow Builder)
          </div>
          <p className="text-sm text-muted-foreground">
            Konfiguriere zusätzliche AI-Provider für den Flow Builder. API Keys werden nur lokal gespeichert.
          </p>
          {serverProviders.filter((p) => p !== 'ollama').length > 0 && (
            <div className="flex items-start gap-2 text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg p-3">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Provider die in <code className="bg-background/50 px-1 rounded text-xs">.env.local</code> konfiguriert sind, werden automatisch erkannt und sind im Flow Builder verfügbar.
              </span>
            </div>
          )}
          <div className="space-y-3">
            {(['anthropic', 'openai', 'openrouter'] as ProviderType[]).map((type) => {
              const config = providerSettings.providers[type];
              const isServerConfigured = serverProviders.includes(type);
              const labels: Record<string, { name: string; placeholder: string; hint: string }> = {
                anthropic: {
                  name: '🧠 Anthropic (Claude)',
                  placeholder: 'sk-ant-...',
                  hint: 'console.anthropic.com → API Keys',
                },
                openai: {
                  name: '💚 OpenAI',
                  placeholder: 'sk-...',
                  hint: 'platform.openai.com → API Keys',
                },
                openrouter: {
                  name: '🔀 OpenRouter',
                  placeholder: 'sk-or-...',
                  hint: 'openrouter.ai → Keys — Zugang zu Claude, GPT, Gemini, Llama etc.',
                },
              };
              const label = labels[type];
              return (
                <div key={type} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{label.name}</span>
                      {isServerConfigured && (
                        <span className="flex items-center gap-1 text-xs text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Server
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={config.enabled}
                        onChange={(e) => handleProviderToggle(type, e.target.checked)}
                      />
                      Aktiv
                    </label>
                  </div>
                  <div>
                    <Input
                      type="password"
                      value={config.apiKey ?? ''}
                      onChange={(e) => handleProviderApiKey(type, e.target.value)}
                      placeholder={label.placeholder}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{label.hint}</p>
                  </div>
                </div>
              );
            })}
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

        {/* ────────────── Audio Services ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Music className="h-5 w-5 text-primary" />
            Audio Services
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            {/* ACE-Step */}
            <div>
              <label className="block font-medium mb-1">ACE-Step URL</label>
              <p className="text-sm text-muted-foreground mb-2">URL des ACE-Step Musik-Generators</p>
              <Input
                value={settings?.aceStepUrl || 'http://localhost:8001'}
                onChange={(e) => handleInputChange('aceStepUrl', e.target.value)}
                placeholder="http://localhost:8001"
              />
              <HealthIndicator endpoint="/api/ace-step/health" label="ACE-Step" />
            </div>

            <div>
              <label className="block font-medium mb-1">ACE-Step Installationspfad</label>
              <p className="text-sm text-muted-foreground mb-2">Pfad zur ACE-Step Installation (für Auto-Start)</p>
              <div className="flex gap-2">
                <Input
                  value={settings?.aceStepPath || ''}
                  onChange={(e) => handleInputChange('aceStepPath', e.target.value)}
                  placeholder="C:\ACE-Step"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => pickFolder('aceStepPath')}
                  disabled={isPickingFolder === 'aceStepPath'}
                >
                  {isPickingFolder === 'aceStepPath' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-4" />

            {/* Qwen3-TTS */}
            <div>
              <label className="block font-medium mb-1">Qwen3-TTS URL</label>
              <p className="text-sm text-muted-foreground mb-2">URL des Qwen3-TTS Sprachsynthese-Servers</p>
              <Input
                value={settings?.qwenTTSUrl || 'http://localhost:7861'}
                onChange={(e) => handleInputChange('qwenTTSUrl', e.target.value)}
                placeholder="http://localhost:7861"
              />
              <HealthIndicator endpoint="/api/qwen-tts/health" label="Qwen3-TTS" />
            </div>

            <div className="border-t border-border pt-4" />

            {/* Auto-Start Toggles */}
            <div className="space-y-3">
              <div className="font-medium">Auto-Start</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">ComfyUI beim Start automatisch starten</div>
                </div>
                <Button
                  variant={settings?.comfyUIAutoStart ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    updateSettings({ comfyUIAutoStart: !settings?.comfyUIAutoStart });
                    showSaved();
                  }}
                >
                  {settings?.comfyUIAutoStart ? 'An' : 'Aus'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">ACE-Step beim Start automatisch starten</div>
                </div>
                <Button
                  variant={settings?.aceStepAutoStart ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    updateSettings({ aceStepAutoStart: !settings?.aceStepAutoStart });
                    showSaved();
                  }}
                >
                  {settings?.aceStepAutoStart ? 'An' : 'Aus'}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Auto-Start erfordert konfigurierte Installationspfade. Die Services werden beim Laden der App gestartet, falls sie nicht bereits laufen.
              </div>
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

        {/* ────────────── Agent ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Zap className="h-5 w-5 text-primary" />
            Agent
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div>
              <label className="block font-medium mb-1">Workspace Pfad</label>
              <p className="text-sm text-muted-foreground mb-2">
                Ordner in dem der Agent Dateien erstellt. Standard: ~/.locai/workspace/
              </p>
              <div className="flex gap-2">
                <Input
                  value={settings?.agentWorkspacePath || ''}
                  onChange={(e) => handleInputChange('agentWorkspacePath', e.target.value)}
                  placeholder="~/.locai/workspace/ (Standard)"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => pickFolder('agentWorkspace')}
                  disabled={isPickingFolder === 'agentWorkspace'}
                >
                  {isPickingFolder === 'agentWorkspace' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              Der Agent kann Dateien nur in erlaubten Verzeichnissen erstellen: Workspace, ~/.locai/, ~/Documents/ und konfigurierte Pfade.
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

        {/* ────────────── Backup & Restore ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Download className="h-5 w-5 text-primary" />
            Backup &amp; Restore
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Exportiere oder importiere alle LocAI-Daten (Einstellungen, Memory, Workspace, RAG-Collections) als ZIP-Backup.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={handleExportBackup}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Backup exportieren
              </Button>
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={handleImportBackupClick}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Backup importieren
              </Button>
            </div>

            {/* Import confirmation dialog */}
            {importConfirm?.show && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-destructive">Backup importieren?</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Dies überschreibt bestehende Daten in <code className="bg-background/50 px-1 rounded text-xs">~/.locai/</code>.
                      Ein automatisches Pre-Import-Backup wird erstellt.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Datei: <strong>{importConfirm.file.name}</strong> ({(importConfirm.file.size / 1024 / 1024).toFixed(1)} MB)
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleImportBackup(importConfirm.file)}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Ja, importieren
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportConfirm(null)}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              💡 Beim Import wird automatisch ein Pre-Import-Backup erstellt, damit du im Notfall zurückkehren kannst.
            </div>
          </div>
        </section>

        {/* ────────────── System Info ────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-primary" />
            System Info
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            {isLoadingStats && !systemStats ? (
              <LoadingState variant="skeleton" rows={4} />
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
