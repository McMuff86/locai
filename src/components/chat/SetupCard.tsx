"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileEdit, Wand2, Image as ImageIcon, Sparkles, Check,
  ChevronDown, Cpu, HardDrive, Box, Layers, Eye,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { OllamaModel } from '../../lib/ollama';
import {
  IMAGE_PROMPT,
  PROMPT_TEMPLATES,
  CATEGORY_LABELS,
  PromptTemplate,
  getTemplatesByCategory,
  getAllCategories
} from '../../lib/prompt-templates';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Model descriptions (German) – keyed by model name prefix / exact match
// ---------------------------------------------------------------------------

const MODEL_DESCRIPTIONS: { pattern: RegExp; description: string }[] = [
  { pattern: /qwen2\.5|qwen3/i,       description: 'Starkes Allround-Modell mit exzellentem Tool-Calling. Ideal für Agent Mode.' },
  { pattern: /qwen/i,                  description: 'Alibabas Qwen-Modellreihe. Gutes Tool-Calling, stark mehrsprachig.' },
  { pattern: /llama3\.[1-9]/i,         description: 'Metas Flaggschiff-Modell. Solides Tool-Calling, gut für Chat und Code.' },
  { pattern: /llama3/i,                description: 'Metas Llama-3-Modell. Vielseitig für Chat und Wissensaufgaben.' },
  { pattern: /llama/i,                 description: 'Metas offenes Sprachmodell. Solide Allround-Performance.' },
  { pattern: /deepseek-r1|deepseek-v3/i, description: 'Reasoning-Modell mit sichtbarem Denkprozess. Stark bei komplexen Aufgaben.' },
  { pattern: /deepseek/i,              description: 'DeepSeeks Sprachmodell. Gut für Code und analytische Aufgaben.' },
  { pattern: /mistral-large/i,         description: 'Mistral Large: leistungsstarkes Flaggschiff mit exzellentem Tool-Calling.' },
  { pattern: /mistral-nemo/i,          description: 'Mistral Nemo: kompaktes, mehrsprachiges Modell für schnelle Aufgaben.' },
  { pattern: /mistral/i,               description: 'Schnelles europäisches Modell. Gut für Chat, solides Tool-Calling.' },
  { pattern: /mixtral/i,               description: 'Mistral MoE-Modell. Hohe Qualität bei guter Effizienz.' },
  { pattern: /codellama/i,             description: 'Spezialisiert auf Code-Generierung und -Analyse.' },
  { pattern: /starcoder/i,             description: 'BigCodes Coding-Spezialist. Unterstützt viele Programmiersprachen.' },
  { pattern: /gemma2/i,                description: 'Googles kompaktes Gemma-2-Modell. Gut für allgemeine Aufgaben.' },
  { pattern: /gemma/i,                 description: 'Googles offenes Gemma-Modell. Leichtgewichtig und effizient.' },
  { pattern: /phi-?[34]/i,             description: 'Microsofts kompaktes Phi-Modell. Überraschend stark für seine Grösse.' },
  { pattern: /phi/i,                   description: 'Microsofts Phi-Modell. Klein und schnell für einfache Aufgaben.' },
  { pattern: /command-r/i,             description: 'Coheres Command-R: optimiert für RAG und Tool-Calling.' },
  { pattern: /hermes/i,                description: 'NousResearch Hermes: fine-tuned für Instruktionsbefolgung und Tool-Calling.' },
  { pattern: /neural-chat/i,           description: 'Intels Neural Chat: optimiert für Konversation.' },
  { pattern: /vicuna/i,                description: 'Vicuna: Chat-fähiges Open-Source-Modell.' },
  { pattern: /orca/i,                  description: 'Microsofts Orca: auf Reasoning fine-tuned.' },
  { pattern: /dolphin/i,               description: 'Uncensored Chat-Modell, gut für kreative Aufgaben.' },
];

/**
 * Returns a German 1–2-sentence description for the given model name.
 * Falls back to a generic size-based hint for unknowns.
 */
function getModelDescription(modelName: string): string {
  for (const { pattern, description } of MODEL_DESCRIPTIONS) {
    if (pattern.test(modelName)) return description;
  }
  // Generic fallback based on parameter size hint in name
  const sizeMatch = modelName.match(/(\d+\.?\d*)b/i);
  if (sizeMatch) {
    const params = parseFloat(sizeMatch[1]);
    if (params <= 3)  return 'Sehr kompaktes Modell. Schnell und ressourcenschonend.';
    if (params <= 8)  return 'Mittelgrosses Modell. Gute Balance zwischen Qualität und Geschwindigkeit.';
    if (params <= 14) return 'Grösseres Modell. Stärker bei komplexen Aufgaben.';
    return 'Leistungsstarkes Grossmodell. Ideal für anspruchsvolle Aufgaben.';
  }
  return 'Lokales Sprachmodell. Für Details Ollama-Dokumentation prüfen.';
}

// Re-export for backwards compatibility
export { IMAGE_PROMPT };

interface SetupCardProps {
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  isLoading: boolean;
  error: string | null;

  defaultPrompt: string;
  customPrompt: string;
  imagePrompt: string;
  activeTab: string;
  isEditingPrompt: boolean;
  onCustomPromptChange: (value: string) => void;
  onImagePromptChange: (value: string) => void;
  onTabChange: (tab: string) => void;
  onResetPrompt: () => void;

  onStartConversation: () => void;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function isVisionModel(model: OllamaModel): boolean {
  const name = model.name.toLowerCase();
  return name.includes('vision') || name.includes('llava') || model.details?.families?.includes('clip') || false;
}

function getModelTags(model: OllamaModel): string[] {
  const tags: string[] = [];
  const name = model.name.toLowerCase();
  if (isVisionModel(model)) tags.push('Vision');
  if (name.includes('code') || name.includes('coder') || name.includes('starcoder') || name.includes('codellama')) tags.push('Code');
  if (name.includes('embed')) tags.push('Embedding');
  if (name.includes('dolphin') || name.includes('uncensored')) tags.push('Uncensored');
  if (name.includes('deepseek')) tags.push('Reasoning');
  return tags;
}

// ---------------------------------------------------------------------------
// Model Tag Badge
// ---------------------------------------------------------------------------

function ModelTag({ label }: { label: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-medium tracking-wide">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Compact Model Selector (dropdown only, no separate info panel)
// ---------------------------------------------------------------------------

function ModelSelector({
  models,
  selectedModel,
  onSelectModel,
}: {
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selected = models.find(m => m.name === selectedModel);
  const sizeGB = selected?.size ? (selected.size / 1024 / 1024 / 1024).toFixed(1) : null;
  const paramSize = selected?.details?.parameter_size ?? null;
  const tags = selected ? getModelTags(selected) : [];

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left",
          "transition-all duration-150",
          "hover:border-primary/50 hover:bg-accent/20",
          isOpen
            ? "border-primary ring-1 ring-primary/20 bg-accent/10"
            : "border-border bg-card/50",
          !selectedModel && "text-muted-foreground"
        )}
      >
        {/* Model icon */}
        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Cpu className="h-3.5 w-3.5 text-primary" />
        </div>

        {/* Model info */}
        <div className="flex-1 min-w-0">
          {selectedModel ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium truncate">{selectedModel}</span>
              {paramSize && (
                <span className="text-xs text-muted-foreground">{paramSize}</span>
              )}
              {sizeGB && (
                <span className="text-xs text-muted-foreground">{sizeGB} GB</span>
              )}
              {tags.map(t => <ModelTag key={t} label={t} />)}
            </div>
          ) : (
            <span className="text-sm">Modell wählen…</span>
          )}
        </div>

        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-150 flex-shrink-0",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-[280px] overflow-y-auto">
          <div className="p-1">
            {models.map(model => {
              const mSize = model.size ? (model.size / 1024 / 1024 / 1024).toFixed(1) : null;
              const mParam = model.details?.parameter_size ?? null;
              const mTags = getModelTags(model);
              const isSelected = selectedModel === model.name;

              return (
                <button
                  key={model.name}
                  type="button"
                  onClick={() => { onSelectModel(model.name); setIsOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors",
                    "hover:bg-accent/50",
                    isSelected && "bg-primary/10 text-primary"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm font-medium truncate", isSelected && "text-primary")}>
                        {model.name}
                      </span>
                      {mTags.map(t => <ModelTag key={t} label={t} />)}
                    </div>
                    {(mParam || mSize) && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {mParam && <span className="text-xs text-muted-foreground">{mParam}</span>}
                        {mParam && mSize && <span className="text-xs text-muted-foreground">·</span>}
                        {mSize && <span className="text-xs text-muted-foreground">{mSize} GB</span>}
                      </div>
                    )}
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model Stats Bar (compact, below selector)
// ---------------------------------------------------------------------------

function ModelStatsBar({ model }: { model: OllamaModel | undefined }) {
  if (!model) return null;

  const sizeGB = model.size ? (model.size / 1024 / 1024 / 1024).toFixed(1) : null;
  const paramSize = model.details?.parameter_size ?? null;
  const quant = model.details?.quantization_level ?? null;
  const family = model.details?.family ?? null;
  const hasVision = isVisionModel(model);

  const stats = [
    paramSize && { icon: <Layers className="h-3 w-3" />, label: 'Params', value: paramSize },
    sizeGB    && { icon: <HardDrive className="h-3 w-3" />, label: 'Size', value: `${sizeGB} GB` },
    quant     && { icon: <Box className="h-3 w-3" />, label: 'Quant', value: quant },
    family    && { icon: <Cpu className="h-3 w-3" />, label: 'Family', value: family },
    hasVision && { icon: <Eye className="h-3 w-3" />, label: 'Vision', value: 'Ja' },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];

  if (stats.length === 0) return null;

  return (
    <div className="flex items-center gap-4 px-1 py-1">
      {stats.map(s => (
        <div key={s.label} className="flex items-center gap-1 text-xs text-muted-foreground">
          {s.icon}
          <span>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Card (compact)
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: PromptTemplate;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150",
        "hover:border-primary/40 hover:bg-accent/30",
        isSelected
          ? "border-primary/60 bg-primary/8 ring-1 ring-primary/20"
          : "border-border/60 bg-transparent"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg flex-shrink-0 leading-none">{template.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium truncate">{template.name}</h4>
            {isSelected && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {template.description}
          </p>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Category filter pills
// ---------------------------------------------------------------------------

function CategoryPill({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 whitespace-nowrap",
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SetupCard main component
// ---------------------------------------------------------------------------

export function SetupCard({
  models,
  selectedModel,
  onSelectModel,
  isLoading,
  error,
  defaultPrompt,
  customPrompt,
  imagePrompt,
  activeTab,
  isEditingPrompt,
  onCustomPromptChange,
  onImagePromptChange,
  onTabChange,
  onResetPrompt,
  onStartConversation,
}: SetupCardProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [activeCategory, setActiveCategory] = useState<PromptTemplate['category'] | 'all'>('all');

  const filteredTemplates = useMemo(() => {
    if (activeCategory === 'all') return PROMPT_TEMPLATES;
    return getTemplatesByCategory(activeCategory);
  }, [activeCategory]);

  const selectedTemplate = useMemo(() =>
    PROMPT_TEMPLATES.find(t => t.id === selectedTemplateId),
    [selectedTemplateId]
  );

  const selectedModelData = models.find(m => m.name === selectedModel);

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplateId(template.id);
    onCustomPromptChange(template.systemPrompt);
    if (activeTab !== 'custom') {
      onTabChange('templates');
    }
  };

  const handleStartWithTemplate = () => {
    if (selectedTemplate) {
      onCustomPromptChange(selectedTemplate.systemPrompt);
    }
    onStartConversation();
  };

  const canStart =
    selectedModel &&
    ((activeTab === 'default') ||
     (activeTab === 'templates' && selectedTemplate) ||
     (activeTab === 'custom' && customPrompt.trim()) ||
     (activeTab === 'image' && imagePrompt.trim()));

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-sm">Lade verfügbare Modelle…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2 max-w-sm px-4">
          <p className="text-sm font-medium text-destructive">Verbindungsfehler</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2 max-w-sm px-4">
          <p className="text-sm font-medium">Keine Modelle gefunden</p>
          <p className="text-xs text-muted-foreground">
            Bitte stelle sicher, dass du Modelle in Ollama installiert hast.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl space-y-4">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Neues Gespräch
          </h1>
          <p className="text-xs text-muted-foreground">
            Wähle ein Modell und eine Vorlage, dann geht es los.
          </p>
        </div>

        {/* ── Model Section ───────────────────────────────────────── */}
        <Card className="border-border/60 bg-card/50 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Modell
            </p>
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
            />
            {/* Model description */}
            {selectedModel && (
              <p className="text-sm text-muted-foreground px-1">
                {getModelDescription(selectedModel)}
              </p>
            )}
            <ModelStatsBar model={selectedModelData} />
          </CardContent>
        </Card>

        {/* ── System Prompt Section ───────────────────────────────── */}
        <Card className="border-border/60 bg-card/50 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Systemanweisungen
              </p>
              {isEditingPrompt && (
                <button
                  onClick={onResetPrompt}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Wand2 className="h-3 w-3" />
                  Zurücksetzen
                </button>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-8">
                <TabsTrigger value="templates" className="text-xs flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span className="hidden sm:inline">Vorlagen</span>
                </TabsTrigger>
                <TabsTrigger value="default" className="text-xs">Standard</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs">Custom</TabsTrigger>
                <TabsTrigger value="image" className="text-xs flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">Bild</span>
                </TabsTrigger>
              </TabsList>

              {/* ── Templates Tab ─────────────────────────────────── */}
              <TabsContent value="templates" className="mt-3 space-y-3">
                {/* Category filter */}
                <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                  <CategoryPill
                    label="Alle"
                    isActive={activeCategory === 'all'}
                    onClick={() => setActiveCategory('all')}
                  />
                  {getAllCategories().map(cat => (
                    <CategoryPill
                      key={cat}
                      label={CATEGORY_LABELS[cat]}
                      isActive={activeCategory === cat}
                      onClick={() => setActiveCategory(cat)}
                    />
                  ))}
                </div>

                {/* Two-column: list left, preview right */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Template list */}
                  <ScrollArea className="h-[260px] rounded-lg border border-border/40 p-1.5">
                    <div className="space-y-1 pr-1">
                      {filteredTemplates.map(template => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          isSelected={selectedTemplateId === template.id}
                          onSelect={() => handleTemplateSelect(template)}
                        />
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Preview panel */}
                  <div className="hidden md:flex flex-col gap-2">
                    {selectedTemplate ? (
                      <>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent/40 border border-border/40">
                          <span className="text-xl leading-none">{selectedTemplate.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{selectedTemplate.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {selectedTemplate.description}
                            </p>
                          </div>
                        </div>
                        <ScrollArea className="flex-1 h-[200px] rounded-md border border-border/40 bg-muted/20">
                          <div className="p-3">
                            <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground leading-relaxed">
                              {selectedTemplate.systemPrompt}
                            </pre>
                          </div>
                        </ScrollArea>
                        <button
                          onClick={() => {
                            onCustomPromptChange(selectedTemplate.systemPrompt);
                            onTabChange('custom');
                          }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <FileEdit className="h-3 w-3" />
                          Anpassen
                        </button>
                      </>
                    ) : (
                      <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground/60">
                        Vorlage auswählen
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* ── Default Tab ───────────────────────────────────── */}
              <TabsContent value="default" className="mt-3 space-y-2">
                <div className="relative">
                  <Textarea
                    value={defaultPrompt}
                    className="min-h-[240px] max-h-[240px] overflow-y-auto font-mono text-xs bg-muted/30 resize-none"
                    readOnly
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 h-7 text-xs"
                    onClick={() => onTabChange('custom')}
                  >
                    <FileEdit className="h-3 w-3 mr-1" />
                    Anpassen
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Optimierter System-Prompt für {selectedModel || 'dieses Modell'}.
                </p>
              </TabsContent>

              {/* ── Custom Tab ────────────────────────────────────── */}
              <TabsContent value="custom" className="mt-3 space-y-2">
                <Textarea
                  value={customPrompt}
                  onChange={e => onCustomPromptChange(e.target.value)}
                  placeholder="Eigene Systemanweisungen eingeben…"
                  className="min-h-[240px] max-h-[240px] overflow-y-auto font-mono text-xs resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Lege fest, wie die KI sich verhalten soll.
                </p>
              </TabsContent>

              {/* ── Image Tab ─────────────────────────────────────── */}
              <TabsContent value="image" className="mt-3 space-y-2">
                <Textarea
                  value={imagePrompt}
                  onChange={e => onImagePromptChange(e.target.value)}
                  placeholder="Anweisungen für Bildgenerierung…"
                  className="min-h-[240px] max-h-[240px] overflow-y-auto font-mono text-xs resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Spezialisiert auf detaillierte Prompts für KI-Bildgeneratoren.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Start Button ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          {activeTab === 'templates' && selectedTemplate && (
            <p className="text-xs text-muted-foreground truncate">
              <span className="font-medium">{selectedTemplate.icon} {selectedTemplate.name}</span>{' '}
              ausgewählt
            </p>
          )}
          <div className="flex-1" />
          <Button
            size="default"
            className="min-w-[140px]"
            onClick={activeTab === 'templates' ? handleStartWithTemplate : onStartConversation}
            disabled={!canStart}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Gespräch starten
          </Button>
        </div>

      </div>
    </div>
  );
}

export default SetupCard;
