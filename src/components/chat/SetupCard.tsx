"use client";

import React, { useState, useMemo } from 'react';
import { FileEdit, Wand2, Image as ImageIcon, Sparkles, Check, ChevronRight } from 'lucide-react';
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
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
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
              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Model
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {models.map((model) => (
                    <Button
                      key={model.name}
                      variant={selectedModel === model.name ? "default" : "outline"}
                      className="justify-start overflow-hidden text-ellipsis"
                      onClick={() => onSelectModel(model.name)}
                    >
                      {model.name}
                    </Button>
                  ))}
                </div>
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
