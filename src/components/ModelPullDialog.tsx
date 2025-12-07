"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Cpu,
  Eye,
  Code,
  Sparkles,
  Brain,
  ExternalLink,
  Zap,
  Filter,
  Trash2,
  Package,
  Calendar
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { OllamaModel } from '../lib/ollama';

interface ModelInfo {
  name: string;
  size: string;
  description: string;
  category?: string;
}

interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

interface ModelPullDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onModelPulled?: (modelName: string) => void;
  installedModels?: string[];
  installedModelsDetails?: OllamaModel[];
  onDeleteModel?: (modelName: string) => Promise<void>;
}

// Category config
const CATEGORIES = {
  all: { icon: Sparkles, label: 'Alle', color: 'text-primary' },
  general: { icon: Sparkles, label: 'Allgemein', color: 'text-blue-500' },
  reasoning: { icon: Brain, label: 'Reasoning', color: 'text-purple-500' },
  vision: { icon: Eye, label: 'Vision', color: 'text-green-500' },
  code: { icon: Code, label: 'Code', color: 'text-orange-500' },
  embedding: { icon: Cpu, label: 'Embeddings', color: 'text-cyan-500' },
  specialized: { icon: Zap, label: 'Spezial', color: 'text-yellow-500' },
};

type CategoryKey = keyof typeof CATEGORIES;

export function ModelPullDialog({
  isOpen,
  onClose,
  onModelPulled,
  installedModels = [],
  installedModelsDetails = [],
  onDeleteModel
}: ModelPullDialogProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const [isPulling, setIsPulling] = useState(false);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'installed'>('available');
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [installedSearchQuery, setInstalledSearchQuery] = useState('');
  
  // Delete model handler
  const handleDeleteModel = async (modelName: string) => {
    if (!onDeleteModel) return;
    if (!window.confirm(`Modell "${modelName}" wirklich löschen?`)) return;
    
    setDeletingModel(modelName);
    try {
      await onDeleteModel(modelName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setDeletingModel(null);
    }
  };
  
  // Filter installed models
  const filteredInstalledModels = installedModelsDetails.filter(model => {
    if (!installedSearchQuery) return true;
    return model.name.toLowerCase().includes(installedSearchQuery.toLowerCase());
  });
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Format file size
  const formatSize = (bytes: number) => {
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(0)} MB`;
  };

  // Fetch available models
  useEffect(() => {
    if (isOpen) {
      fetch('/api/ollama/pull')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setModels(data.models);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Pull a model
  const pullModel = useCallback(async (modelName: string) => {
    setIsPulling(true);
    setPullingModel(modelName);
    setProgress(null);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as PullProgress;
            setProgress(data);

            if (data.status === 'success') {
              setSuccess(modelName);
              onModelPulled?.(modelName);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setIsPulling(false);
      setPullingModel(null);
    }
  }, [onModelPulled]);

  // Filter models
  const filteredModels = models.filter(model => {
    const matchesSearch = searchQuery === '' || 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || 
      model.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Check if model is installed
  const isInstalled = (modelName: string) => {
    const baseName = modelName.split(':')[0].toLowerCase();
    return installedModels.some(m => m.toLowerCase().includes(baseName));
  };

  // Format progress
  const formatProgress = (prog: PullProgress) => {
    if (prog.total && prog.completed) {
      const percent = Math.round((prog.completed / prog.total) * 100);
      const completedMB = (prog.completed / 1024 / 1024).toFixed(0);
      const totalMB = (prog.total / 1024 / 1024).toFixed(0);
      return { percent, text: `${completedMB} / ${totalMB} MB` };
    }
    return { percent: 0, text: prog.status };
  };

  // Check if custom model name
  const isCustomModel = searchQuery.length > 0 && 
    !models.some(m => m.name.toLowerCase() === searchQuery.toLowerCase());

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card rounded-lg shadow-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Modell Manager</h2>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://ollama.com/library"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                ollama.com
              </a>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'available' | 'installed')} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-3 border-b border-border">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="available" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Verfügbar
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded ml-1">
                    {models.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="installed" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Installiert
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded ml-1">
                    {installedModelsDetails.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Available Tab */}
            <TabsContent value="available" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
              {/* Search & Categories */}
              <div className="p-4 border-b border-border space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Modell suchen oder eigenen Namen eingeben (z.B. 'llama3:latest')..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && isCustomModel) {
                        pullModel(searchQuery);
                      }
                    }}
                  />
                </div>
                
                {/* Category Filter */}
                <div className="flex items-center gap-1 flex-wrap">
                  <Filter className="h-4 w-4 text-muted-foreground mr-1" />
                  {Object.entries(CATEGORIES).map(([key, { icon: Icon, label, color }]) => (
                    <Button
                      key={key}
                      variant={selectedCategory === key ? 'secondary' : 'ghost'}
                      size="sm"
                      className={`h-7 text-xs ${selectedCategory === key ? '' : 'text-muted-foreground'}`}
                      onClick={() => setSelectedCategory(key as CategoryKey)}
                    >
                      <Icon className={`h-3 w-3 mr-1 ${selectedCategory === key ? color : ''}`} />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

          {/* Progress/Error/Success */}
          {(isPulling || error || success) && (
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              {isPulling && progress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Downloading <span className="font-mono">{pullingModel}</span>...
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {formatProgress(progress).text}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${formatProgress(progress).percent}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {progress.status}
                  </p>
                </div>
              )}
              
              {error && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              
              {success && (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">{success} erfolgreich installiert!</span>
                </div>
              )}
            </div>
          )}

              {/* Model List */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                  {/* Custom model input */}
                  {isCustomModel && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Download className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium font-mono">{searchQuery}</p>
                            <p className="text-sm text-muted-foreground">
                              Benutzerdefiniertes Modell von ollama.com pullen
                            </p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => pullModel(searchQuery)}
                          disabled={isPulling}
                        >
                          {isPulling && pullingModel === searchQuery ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>Pull</>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        💡 Tipp: Verwende Tags wie <code className="bg-muted px-1 rounded">:7b</code>, <code className="bg-muted px-1 rounded">:13b</code>, <code className="bg-muted px-1 rounded">:latest</code>
                      </p>
                    </motion.div>
                  )}
                  
                  {/* No results */}
                  {filteredModels.length === 0 && !isCustomModel && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Keine Modelle gefunden</p>
                      <p className="text-sm mt-1">
                        Gib einen Namen ein um ein beliebiges Modell zu pullen
                      </p>
                    </div>
                  )}
                  
                  {/* Model grid */}
                  <div className="grid gap-2">
                    {filteredModels.map(model => {
                      const category = model.category as keyof typeof CATEGORIES || 'general';
                      const { icon: CategoryIcon, color } = CATEGORIES[category] || CATEGORIES.general;
                      const installed = isInstalled(model.name);
                      
                      return (
                        <div
                          key={model.name}
                          className={`p-3 rounded-lg border transition-all ${
                            installed 
                              ? 'border-green-500/30 bg-green-500/5' 
                              : 'border-border hover:border-primary/50 hover:bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`p-2 rounded-lg flex-shrink-0 ${
                                installed ? 'bg-green-500/10' : 'bg-muted'
                              }`}>
                                <CategoryIcon className={`h-4 w-4 ${
                                  installed ? 'text-green-500' : color
                                }`} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium font-mono truncate">{model.name}</p>
                                  {installed && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {model.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right hidden sm:block">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <HardDrive className="h-3 w-3" />
                                  {model.size}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={installed ? 'outline' : 'default'}
                                disabled={isPulling}
                                onClick={() => pullModel(model.name)}
                                className="min-w-[70px]"
                                title={installed ? 'Prüft auf Updates und installiert neue Version falls verfügbar' : 'Modell herunterladen'}
                              >
                                {pullingModel === model.name ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : installed ? (
                                  'Re-pull'
                                ) : (
                                  'Pull'
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-border bg-muted/30">
                <p className="text-xs text-muted-foreground/60">
                  💡 Re-pull = Prüft automatisch auf Updates. Nur neue Layers werden heruntergeladen.
                </p>
              </div>
            </TabsContent>
            
            {/* Installed Tab */}
            <TabsContent value="installed" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
              {/* Search */}
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Installierte Modelle durchsuchen..."
                    value={installedSearchQuery}
                    onChange={e => setInstalledSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              {/* Installed Model List */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {filteredInstalledModels.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Keine installierten Modelle gefunden</p>
                        <p className="text-sm mt-1">
                          Wechsle zum Tab &quot;Verfügbar&quot; um Modelle zu installieren
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {filteredInstalledModels.map(model => {
                          const sizeFormatted = formatSize(model.size);
                          const modifiedFormatted = formatDate(model.modified_at);
                          
                          return (
                            <div
                              key={model.name}
                              className="p-3 rounded-lg border border-border hover:border-primary/30 transition-all bg-card"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="p-2 rounded-lg bg-green-500/10 flex-shrink-0">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium font-mono truncate">{model.name}</p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <HardDrive className="h-3 w-3" />
                                        {sizeFormatted}
                                      </span>
                                      {model.details?.parameter_size && (
                                        <span className="flex items-center gap-1">
                                          <Cpu className="h-3 w-3" />
                                          {model.details.parameter_size}
                                        </span>
                                      )}
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {modifiedFormatted}
                                      </span>
                                    </div>
                                    {model.details?.quantization_level && (
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                          {model.details.family}
                                        </span>
                                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                          {model.details.quantization_level}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isPulling}
                                    onClick={() => pullModel(model.name)}
                                    title="Auf Updates prüfen"
                                  >
                                    {pullingModel === model.name ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      'Update'
                                    )}
                                  </Button>
                                  {onDeleteModel && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      disabled={deletingModel === model.name}
                                      onClick={() => handleDeleteModel(model.name)}
                                      title="Modell löschen"
                                    >
                                      {deletingModel === model.name ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Footer */}
              <div className="p-3 border-t border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {installedModelsDetails.length} Modell{installedModelsDetails.length !== 1 ? 'e' : ''} installiert
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gesamt: {formatSize(installedModelsDetails.reduce((acc, m) => acc + m.size, 0))}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ModelPullDialog;
