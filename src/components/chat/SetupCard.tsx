"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileEdit, Wand2, Image as ImageIcon, Sparkles, Check, ChevronRight, ChevronDown, Cpu, HardDrive, Eye, Box, Layers } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '../ui/card';
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

// Re-export for backwards compatibility
export { IMAGE_PROMPT };

interface SetupCardProps {
  // Model props
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  isLoading: boolean;
  error: string | null;
  
  // Prompt props
  defaultPrompt: string;
  customPrompt: string;
  imagePrompt: string;
  activeTab: string;
  isEditingPrompt: boolean;
  onCustomPromptChange: (value: string) => void;
  onImagePromptChange: (value: string) => void;
  onTabChange: (tab: string) => void;
  onResetPrompt: () => void;
  
  // Actions
  onStartConversation: () => void;
}

// Template Card Component
function TemplateCard({ 
  template, 
  isSelected, 
  onSelect 
}: { 
  template: PromptTemplate; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all duration-200",
        "hover:border-primary/50 hover:bg-accent/50",
        isSelected 
          ? "border-primary bg-primary/10 ring-1 ring-primary/30" 
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{template.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-sm truncate">{template.name}</h4>
            {isSelected && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {template.description}
          </p>
        </div>
      </div>
    </button>
  );
}

// Helper: detect if model is a vision model
function isVisionModel(model: OllamaModel): boolean {
  const name = model.name.toLowerCase();
  return name.includes('vision') || name.includes('llava') || model.details?.families?.includes('clip') || false;
}

// Helper: detect model capability tags
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

// Helper: format date
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Model Selector Component with Dropdown + Info Panel
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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedModelData = models.find(m => m.name === selectedModel);
  const selectedSizeGB = selectedModelData?.size ? (selectedModelData.size / 1024 / 1024 / 1024).toFixed(1) : null;
  const selectedParamSize = selectedModelData?.details?.parameter_size || null;
  const selectedTags = selectedModelData ? getModelTags(selectedModelData) : [];

  return (
    <div className="flex gap-4">
      {/* Dropdown */}
      <div className="relative w-full max-w-sm" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left transition-colors",
            "hover:border-primary/50 hover:bg-accent/30",
            isOpen ? "border-primary ring-1 ring-primary/30" : "border-border",
            selectedModel ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <div className="flex-1 min-w-0">
            {selectedModel ? (
              <div>
                <span className="font-medium text-sm">{selectedModel}</span>
                {selectedParamSize && (
                  <span className="text-xs text-muted-foreground ml-2">{selectedParamSize}</span>
                )}
              </div>
            ) : (
              <span className="text-sm">Select a model...</span>
            )}
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
            <ScrollArea className="max-h-[300px]">
              <div className="p-1">
                {models.map((model) => {
                  const sizeGB = model.size ? (model.size / 1024 / 1024 / 1024).toFixed(1) : null;
                  const paramSize = model.details?.parameter_size || null;
                  const tags = getModelTags(model);
                  const isSelected = selectedModel === model.name;

                  return (
                    <button
                      key={model.name}
                      type="button"
                      onClick={() => {
                        onSelectModel(model.name);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                        "hover:bg-accent/50",
                        isSelected && "bg-primary/10 text-primary"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium truncate", isSelected && "text-primary")}>
                            {model.name}
                          </span>
                          {tags.map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {paramSize && <span className="text-xs text-muted-foreground">{paramSize}</span>}
                          {paramSize && sizeGB && <span className="text-xs text-muted-foreground">•</span>}
                          {sizeGB && <span className="text-xs text-muted-foreground">{sizeGB} GB</span>}
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className={cn(
        "flex-1 rounded-lg border border-border bg-card/50 p-4 transition-all",
        !selectedModelData && "flex items-center justify-center"
      )}>
        {selectedModelData ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">{selectedModelData.name}</h4>
              {selectedTags.map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                  {tag}
                </span>
              ))}
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {selectedParamSize && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Parameters</span>
                  </div>
                  <p className="text-sm font-semibold">{selectedParamSize}</p>
                </div>
              )}
              
              {selectedSizeGB && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <HardDrive className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Size</span>
                  </div>
                  <p className="text-sm font-semibold">{selectedSizeGB} GB</p>
                </div>
              )}
              
              {selectedModelData.details?.quantization_level && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Box className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Quantization</span>
                  </div>
                  <p className="text-sm font-semibold">{selectedModelData.details.quantization_level}</p>
                </div>
              )}
              
              {selectedModelData.details?.family && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Family</span>
                  </div>
                  <p className="text-sm font-semibold">{selectedModelData.details.family}</p>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4 pt-1 border-t border-border/50">
              {selectedModelData.details?.format && (
                <span className="text-xs text-muted-foreground">
                  Format: <span className="text-foreground font-medium">{selectedModelData.details.format}</span>
                </span>
              )}
              {isVisionModel(selectedModelData) && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Vision-fähig
                </span>
              )}
              {selectedModelData.modified_at && (
                <span className="text-xs text-muted-foreground">
                  Modified: {formatDate(selectedModelData.modified_at)}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a model to see details</p>
        )}
      </div>
    </div>
  );
}

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
  onStartConversation
}: SetupCardProps) {
  
  // Template selection state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [activeCategory, setActiveCategory] = useState<PromptTemplate['category'] | 'all'>('all');
  
  // Get filtered templates
  const filteredTemplates = useMemo(() => {
    if (activeCategory === 'all') {
      return PROMPT_TEMPLATES;
    }
    return getTemplatesByCategory(activeCategory);
  }, [activeCategory]);
  
  // Get selected template
  const selectedTemplate = useMemo(() => {
    return PROMPT_TEMPLATES.find(t => t.id === selectedTemplateId);
  }, [selectedTemplateId]);
  
  // Handle template selection
  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplateId(template.id);
    // Copy template prompt to custom prompt for potential editing
    onCustomPromptChange(template.systemPrompt);
    // Switch to templates tab to show the selection
    if (activeTab === 'custom') {
      // Stay on custom if user is there
    } else {
      onTabChange('templates');
    }
  };
  
  // Start with selected template
  const handleStartWithTemplate = () => {
    if (selectedTemplate) {
      onCustomPromptChange(selectedTemplate.systemPrompt);
    }
    onStartConversation();
  };
  
  const canStart = selectedModel && 
    ((activeTab === "default") ||
     (activeTab === "templates" && selectedTemplate) ||
     (activeTab === "custom" && customPrompt.trim()) ||
     (activeTab === "image" && imagePrompt.trim()));

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Setup Your AI Assistant
          </CardTitle>
          <CardDescription>
            Select a model and choose a specialized prompt template for your task
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-4">
              <div className="animate-pulse flex space-x-2 justify-center mb-4">
                <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
              </div>
              <p>Loading available models...</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4">
              {error}
            </div>
          ) : models.length === 0 ? (
            <div className="text-center p-4">
              <p>No models found. Please ensure you have models installed in Ollama.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Model Selection - Dropdown + Info Panel */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Model
                </label>
                <ModelSelector
                  models={models}
                  selectedModel={selectedModel}
                  onSelectModel={onSelectModel}
                />
              </div>
              
              {/* System Instructions with Templates */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium">
                    System Instructions
                  </label>
                  <div className="flex gap-2">
                    {isEditingPrompt && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={onResetPrompt}
                        title="Reset to default prompt"
                      >
                        <Wand2 className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
                
                <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="templates" className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4" />
                      <span className="hidden sm:inline">Templates</span>
                    </TabsTrigger>
                    <TabsTrigger value="default">Default</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                    <TabsTrigger value="image" className="flex items-center gap-1">
                      <ImageIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Image</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Templates Tab */}
                  <TabsContent value="templates" className="space-y-4">
                    {/* Category Filter */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={activeCategory === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveCategory('all')}
                      >
                        Alle
                      </Button>
                      {getAllCategories().map((category) => (
                        <Button
                          key={category}
                          variant={activeCategory === category ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setActiveCategory(category)}
                        >
                          {CATEGORY_LABELS[category]}
                        </Button>
                      ))}
                    </div>
                    
                    {/* Template Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Template List */}
                      <ScrollArea className="h-[350px] rounded-lg border p-2">
                        <div className="space-y-2 pr-2">
                          {filteredTemplates.map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              isSelected={selectedTemplateId === template.id}
                              onSelect={() => handleTemplateSelect(template)}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                      
                      {/* Template Preview */}
                      <div className="space-y-2">
                        {selectedTemplate ? (
                          <>
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
                              <span className="text-2xl">{selectedTemplate.icon}</span>
                              <div>
                                <h4 className="font-medium">{selectedTemplate.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {selectedTemplate.description}
                                </p>
                              </div>
                            </div>
                            <ScrollArea className="h-[290px] rounded-lg border">
                              <div className="p-3">
                                <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                                  {selectedTemplate.systemPrompt}
                                </pre>
                              </div>
                            </ScrollArea>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                onCustomPromptChange(selectedTemplate.systemPrompt);
                                onTabChange('custom');
                              }}
                            >
                              <FileEdit className="h-4 w-4 mr-2" />
                              Customize this template
                              <ChevronRight className="h-4 w-4 ml-auto" />
                            </Button>
                          </>
                        ) : (
                          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                            Select a template to preview
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="default" className="space-y-2">
                    <div className="relative">
                      <Textarea 
                        value={defaultPrompt}
                        className="min-h-[350px] max-h-[350px] overflow-y-auto font-mono text-sm bg-muted" 
                        readOnly
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => onTabChange("custom")}
                      >
                        <FileEdit className="h-4 w-4 mr-1" />
                        Customize
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is the recommended system prompt for {selectedModel}. It provides optimal instructions for this model.
                    </p>
                  </TabsContent>
                  
                  <TabsContent value="custom" className="space-y-2">
                    <Textarea 
                      value={customPrompt}
                      onChange={(e) => onCustomPromptChange(e.target.value)}
                      placeholder="Enter custom system instructions..."
                      className="min-h-[350px] max-h-[350px] overflow-y-auto font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Customize how the AI should behave. These instructions act as a foundation for the entire conversation.
                    </p>
                  </TabsContent>
                  
                  <TabsContent value="image" className="space-y-2">
                    <Textarea 
                      value={imagePrompt}
                      onChange={(e) => onImagePromptChange(e.target.value)}
                      placeholder="Enter image generation instructions..."
                      className="min-h-[350px] max-h-[350px] overflow-y-auto font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Specialized instructions for creating detailed prompts for AI image generators. Use with image generation models.
                    </p>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          {activeTab === 'templates' && selectedTemplate && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{selectedTemplate.icon} {selectedTemplate.name}</span> selected
            </p>
          )}
          <div className="flex-1" />
          <Button 
            className="w-full sm:w-auto" 
            onClick={activeTab === 'templates' ? handleStartWithTemplate : onStartConversation}
            disabled={!canStart}
          >
            Start Conversation
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default SetupCard;
