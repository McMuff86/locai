"use client";

import React from 'react';
import { FileEdit, Wand2, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { OllamaModel } from '../../lib/ollama';

// Standard image prompt text
export const IMAGE_PROMPT = `You are an expert in crafting image prompts for AI image generators to produce highly realistic, visually stunning images.

Create detailed, descriptive prompts in the format:

[Main subject], [Style], [Composition], [Lighting], [Mood], [Additional details]

The entire prompt must be in English. Append this to the end of each prompt: --v 6.1 --p 50546295-8f4d-4857-9aed-6a803834ec93

Use the following examples as inspiration:

Diamond ring topped with a large blue sapphire reflecting light, adorned with dragon-patterned decorations, set against a black background, in an anime-style 2D game art design.
Modernist Dynamic Dimensions collage featuring a fashionable Afro-American man amidst diverse, playful visual elements, creating high-energy, impactful visuals in a vibrant virtual world, illustration concept.
Quincy Jones (producer of "Just Once"), depicted in a hip-hop illustration blending styles of Glen Fabry and Jon Klassen, clip art aesthetic.
Minimalist photography of a road stretching toward the horizon in Iceland, flanked by dark desert and pink misty mountains, in Richard Young's low-contrast style, with a black background, high resolution, rich details, captured using a Nikon D850 with long exposure, 8K.
Architectural extreme wide-angle shot of a Frankfurt street, low-angle view, showcasing modern glass-and-steel skyscrapers, straight lines, central perspective, with cloudy, misty diffuse light, in black-and-white analog film photography.
Vortex-shaped sea of pure white clouds spiraling outward from the center, CG movie blockbuster style, conveying dramatic impact and force.
These examples are guides—do not include all of them in your prompt.

Be creative, experimenting with unique styles, compositions, and details to produce world-class, breathtaking images.
Focus on vivid textures, dynamic elements, and precise lighting to enhance realism and visual appeal.`;

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
  
  const canStart = selectedModel && 
    ((activeTab === "default") ||
     (activeTab === "custom" && customPrompt.trim()) ||
     (activeTab === "image" && imagePrompt.trim()));

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Setup Your AI Assistant</CardTitle>
          <CardDescription>
            Select a model and customize how it should behave
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
              
              {/* System Instructions */}
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
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="default">Default</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                    <TabsTrigger value="image" className="flex items-center gap-1">
                      <ImageIcon className="h-4 w-4" />
                      <span>Image Prompt</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="default" className="space-y-2">
                    <div className="relative">
                      <Textarea 
                        value={defaultPrompt}
                        className="min-h-[400px] max-h-[400px] overflow-y-auto font-mono text-sm bg-muted" 
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
                      className="min-h-[400px] max-h-[400px] overflow-y-auto font-mono text-sm"
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
                      className="min-h-[400px] max-h-[400px] overflow-y-auto font-mono text-sm"
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
        <CardFooter className="flex justify-end gap-2">
          <Button 
            className="w-full sm:w-auto" 
            onClick={onStartConversation}
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

