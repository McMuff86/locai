"use client";

import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChatContainer } from "../../components/chat/ChatContainer";
import { ChatInput } from "../../components/chat/ChatInput";
import { Conversation, Message, MessageContent, MessageImageContent } from "../../types/chat";
import { getOllamaModels, sendChatMessage, OllamaModel, getModelSystemContent } from "../../lib/ollama";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "../../components/ui/card";
import { ThemeToggle } from "../../components/ui/theme-toggle";
import Link from "next/link";
import { Home, ChevronDown, Check, FileEdit, Wand2, Image as ImageIcon, Save, Menu, X, FolderOpen, Download, Upload, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ConversationSidebar } from "../../components/chat/ConversationSidebar";
import { getSavedConversations, saveConversation, deleteConversation, exportConversationsToFile, importConversationsFromFile, clearAllConversations } from "../../lib/storage";
import { useToast } from "../../components/ui/use-toast";
import { ToastAction } from "../../components/ui/toast";

// Standard image prompt text
const IMAGE_PROMPT = `You are an expert in crafting image prompts for AI image generators to produce highly realistic, visually stunning images.

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

export default function ChatPage() {
  // Model state
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  // System prompt state
  const [defaultPrompt, setDefaultPrompt] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [imagePrompt, setImagePrompt] = useState<string>(IMAGE_PROMPT);
  const [activeTab, setActiveTab] = useState<string>("default");
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);

  // Chat state
  const [conversation, setConversation] = useState<Conversation>({
    id: uuidv4(),
    title: "New Conversation",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const [isLoading, setIsLoading] = useState(false);
  
  // Sidebar state
  const [savedConversations, setSavedConversations] = useState<Conversation[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);

  const { toast } = useToast();

  // Load saved conversations on startup
  useEffect(() => {
    setSavedConversations(getSavedConversations());
  }, []);

  // Fetch models when the page loads
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsModelLoading(true);
        const ollamaModels = await getOllamaModels();
        setModels(ollamaModels);
        
        // If models are available, select the first one
        if (ollamaModels.length > 0) {
          setSelectedModel(ollamaModels[0].name);
          // Load the default system prompt for the selected model
          const systemPrompt = getModelSystemContent(ollamaModels[0].name);
          setDefaultPrompt(systemPrompt);
          setCustomPrompt(systemPrompt);
        }
        
        setModelError(null);
      } catch (error) {
        console.error("Error loading models:", error);
        setModelError("Connection to Ollama could not be established. Please check if Ollama is running.");
      } finally {
        setIsModelLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Update default prompt when model changes
  useEffect(() => {
    if (selectedModel) {
      const systemPrompt = getModelSystemContent(selectedModel);
      setDefaultPrompt(systemPrompt);
      if (!isEditingPrompt) {
        setCustomPrompt(systemPrompt);
      }
    }
  }, [selectedModel]);

  // Check for vision model availability during startup
  useEffect(() => {
    const checkVisionModelAvailability = async () => {
      try {
        const availableModels = await getOllamaModels();
        const hasVisionModel = availableModels.some(model => 
          model.name.toLowerCase().includes('vision')
        );
        
        if (!hasVisionModel) {
          // Show a toast indicating that users might want to install a vision model
          toast({
            title: "Vision-Modell nicht gefunden",
            description: "Um Bilder analysieren zu können, führen Sie bitte 'ollama pull llama3.2-vision' aus.",
            variant: "default",
            duration: 10000,
          });
        }
      } catch (error) {
        console.error("Error checking for vision models:", error);
      }
    };
    
    checkVisionModelAvailability();
  }, [toast]);

  // Save the current conversation
  const handleSaveConversation = () => {
    // Don't save empty conversations
    if (conversation.messages.length <= 1) {
      toast({
        title: "Cannot save empty conversation",
        description: "Add at least one message before saving.",
        variant: "destructive"
      });
      return;
    }
    
    // Create a copy of the conversation to save
    const conversationToSave = {
      ...conversation,
      updatedAt: new Date() // Update timestamp
    };
    
    // Generate a title from the first user message if title is default
    if (conversation.title === "New Conversation" || conversation.title === `Chat with ${selectedModel}`) {
      const firstUserMessage = conversation.messages.find(msg => msg.role === 'user');
      if (firstUserMessage) {
        let title = "Neue Konversation";
        const content = firstUserMessage.content;
        
        if (typeof content === 'string') {
          // Text content
          title = content.length > 30 ? `${content.substring(0, 30)}...` : content;
        } else if (Array.isArray(content) && content.length > 0) {
          // Mixed content array
          // Try to find first text item
          const firstText = content.find(item => typeof item === 'string');
          if (firstText && typeof firstText === 'string') {
            title = firstText.length > 30 ? `${firstText.substring(0, 30)}...` : firstText;
          } else {
            // If no text, indicate it's an image conversation
            title = "Bildanalyse-Konversation";
          }
        } else if (typeof content === 'object' && (content as any).type === 'image') {
          // Single image content
          title = "Bildanalyse-Konversation";
        }
        
        conversationToSave.title = title;
      }
    }
    
    // Save and update the list
    if (saveConversation(conversationToSave)) {
      setSavedConversations(getSavedConversations());
      toast({
        title: "Conversation saved",
        description: "Your conversation has been saved successfully.",
      });
    } else {
      toast({
        title: "Save failed",
        description: "Failed to save conversation. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Delete a conversation
  const handleDeleteConversation = (conversationId: string) => {
    if (deleteConversation(conversationId)) {
      setSavedConversations(getSavedConversations());
      
      // If the current conversation was deleted, create a new one
      if (conversation.id === conversationId) {
        setConversation({
          id: uuidv4(),
          title: "New Conversation",
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      toast({
        title: "Conversation deleted",
        description: "The conversation has been deleted.",
      });
    } else {
      toast({
        title: "Delete failed",
        description: "Failed to delete conversation. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Load a conversation
  const handleSelectConversation = (selectedConversation: Conversation) => {
    // Make sure to create a deep copy of the loaded conversation to avoid reference issues
    const loadedConversation = {
      ...selectedConversation,
      messages: selectedConversation.messages.map(msg => ({
        ...msg,
        isLoaded: true
      }))
    };
    
    // Set conversation with marked messages
    setConversation(loadedConversation);
    
    // Try to identify and set the correct model
    const systemMsg = loadedConversation.messages.find(m => m.role === 'system');
    if (systemMsg && systemMsg.modelName && models.some(m => m.name === systemMsg.modelName)) {
      setSelectedModel(systemMsg.modelName);
      
      // Also set the appropriate prompt template
      const defaultSystemContent = getModelSystemContent(systemMsg.modelName);
      
      // Only set custom prompt if the content is a string
      if (typeof systemMsg.content === 'string') {
        if (systemMsg.content !== defaultSystemContent) {
          setCustomPrompt(systemMsg.content);
          setIsEditingPrompt(true);
        } else {
          setCustomPrompt(defaultSystemContent);
          setIsEditingPrompt(false);
        }
      } else {
        // If the content is not a string (e.g., contains images), just use the default prompt
        setCustomPrompt(defaultSystemContent);
        setIsEditingPrompt(false);
      }
    }
    
    // Show toast confirmation when loading a conversation
    toast({
      title: "Konversation geladen",
      description: `"${typeof loadedConversation.title === 'string' ? loadedConversation.title : 'Bildkonversation'}" wurde erfolgreich geladen.`,
    });
  };

  // Start a new conversation
  const handleNewConversation = () => {
    setConversation({
      id: uuidv4(),
      title: "New Conversation",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  // Function to set up a new conversation
  const startConversation = () => {
    if (!selectedModel) return;

    // Determine which system prompt to use based on the active tab
    let systemContent: string;
    switch (activeTab) {
      case "image":
        systemContent = imagePrompt;
        break;
      case "custom":
        systemContent = customPrompt;
        break;
      default: // "default"
        systemContent = defaultPrompt;
        break;
    }

    // Create system message with model information
    const systemMessage: Message = {
      id: uuidv4(),
      role: "system",
      content: systemContent,
      timestamp: new Date(),
      modelName: selectedModel // Store the model name in the message
    };

    setConversation(prev => ({
      ...prev,
      title: `Chat with ${selectedModel}`,
      messages: [systemMessage],
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Reset editing state for next time
    setIsEditingPrompt(false);
  };

  // Handle model change during active conversation
  const handleModelChange = (newModel: string) => {
    if (newModel === selectedModel) return;
    
    // Add system message about model change
    const systemMessage: Message = {
      id: uuidv4(),
      role: "system",
      content: `Switching to model: ${newModel}. Previous context is maintained, but response style may change based on the new model's capabilities.`,
      timestamp: new Date(),
      modelName: newModel
    };
    
    setConversation(prev => ({
      ...prev,
      title: `Chat with ${newModel}`,
      messages: [...prev.messages, systemMessage],
      updatedAt: new Date()
    }));
    
    setSelectedModel(newModel);
  };

  // Send chat message
  const handleSendMessage = async (content: string, images?: File[]) => {
    if (!selectedModel || (!content.trim() && (!images || images.length === 0))) return;

    // Check if we need to switch to a vision model
    let currentModel = selectedModel;
    if (images && images.length > 0) {
      // We need a vision model for images
      const isCurrentlyVisionModel = currentModel.toLowerCase().includes('vision');
      
      if (!isCurrentlyVisionModel) {
        // Find vision models
        const visionModels = models.filter(m => 
          m.name.toLowerCase().includes('vision')
        );
        
        if (visionModels.length > 0) {
          // Switch to the first available vision model
          currentModel = visionModels[0].name;
          
          toast({
            title: "Verwende Vision-Modell",
            description: `Bilder werden mit ${currentModel} analysiert`,
          });
          
          // Update the selected model for future messages
          setSelectedModel(currentModel);
        } else {
          toast({
            title: "Warnung",
            description: "Kein Vision-Modell verfügbar. Bilder können möglicherweise nicht korrekt verarbeitet werden.",
            variant: "destructive"
          });
        }
      }
    }

    // Process images if any
    let messageContent: MessageContent = content;
    
    if (images && images.length > 0) {
      // Convert images to data URLs
      const imageContents: MessageImageContent[] = await Promise.all(
        images.map(async (file) => {
          return new Promise<MessageImageContent>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target?.result) {
                resolve({
                  type: 'image',
                  url: e.target.result as string,
                  alt: file.name
                });
              }
            };
            reader.readAsDataURL(file);
          });
        })
      );
      
      // If there's also text content, add it as well
      if (content.trim()) {
        messageContent = [content, ...imageContents] as MessageContent;
      } else {
        messageContent = imageContents as unknown as MessageContent;
      }
    }

    // Create user message
    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
      modelName: currentModel
    };

    // Update conversation
    setConversation(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      updatedAt: new Date()
    }));

    // Set loading state
    setIsLoading(true);

    try {
      // Prepare messages for the Ollama API
      const apiMessages = conversation.messages.map(message => ({
        role: message.role as 'system' | 'user' | 'assistant',
        content: message.content
      }));
      
      // Add the new user message
      apiMessages.push({
        role: 'user',
        content: messageContent
      });

      // Send chat request to Ollama using the potentially updated model
      let responseContent = await sendChatMessage(currentModel, apiMessages);
      
      // For testing/demo purposes only: Add thinking process tags if not present and content contains a question mark
      // In a real scenario, these tags would come from models that naturally include reasoning steps
      if (content.includes('?') && !responseContent.includes('<think>') && Math.random() > 0.5) {
        const demoThinking = `<think>
Let me think through this step-by-step:
1. The user asked: "${content}"
2. I need to consider what they're actually looking for
3. This seems like a question about ${content.includes('how') ? 'process' : content.includes('why') ? 'reasoning' : 'factual information'}
4. Let me search my knowledge base for relevant information
5. I should structure my response with ${content.length > 50 ? 'detailed explanations' : 'concise points'}
6. I need to make sure my answer is accurate and helpful
</think>

`;
        responseContent = demoThinking + responseContent;
      }

      // Create bot response
      const botResponse: Message = {
        id: uuidv4(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
        modelName: currentModel
      };

      // Update conversation with bot response
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, botResponse],
        updatedAt: new Date()
      }));
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Show error message as bot response
      const errorMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "An error occurred. Please try again later.",
        timestamp: new Date(),
        modelName: currentModel
      };
      
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        updatedAt: new Date()
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // UI helper to edit prompt 
  const handleCustomPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomPrompt(e.target.value);
    setIsEditingPrompt(true);
  };

  // UI helper to edit image prompt
  const handleImagePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setImagePrompt(e.target.value);
    setIsEditingPrompt(true);
  };

  // Reset custom prompt to default
  const resetToDefaultPrompt = () => {
    if (activeTab === "image") {
      setImagePrompt(IMAGE_PROMPT);
    } else {
      setCustomPrompt(defaultPrompt);
    }
    setIsEditingPrompt(false);
  };

  // Handle export conversations to file
  const handleExportConversations = async () => {
    const result = await exportConversationsToFile();
    
    if (result) {
      toast({
        title: "Export erfolgreich",
        description: "Alle Konversationen wurden erfolgreich exportiert.",
      });
    } else {
      toast({
        title: "Export fehlgeschlagen",
        description: "Es gab ein Problem beim Exportieren der Konversationen oder es sind keine vorhanden.",
        variant: "destructive"
      });
    }
  };
  
  // Handle import conversations from file
  const handleImportConversations = async () => {
    const result = await importConversationsFromFile();
    
    if (result.success) {
      setSavedConversations(getSavedConversations());
      
      toast({
        title: "Import erfolgreich",
        description: `${result.count} neue Konversationen wurden erfolgreich importiert.`,
      });
    } else {
      toast({
        title: "Import fehlgeschlagen",
        description: "Es gab ein Problem beim Importieren der Konversationen.",
        variant: "destructive"
      });
    }
  };

  // Handle clear all conversations
  const handleClearAllConversations = () => {
    // Show confirmation dialog
    if (window.confirm("Sind Sie sicher, dass Sie ALLE gespeicherten Konversationen löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.")) {
      if (clearAllConversations()) {
        setSavedConversations([]);
        
        toast({
          title: "Konversationen gelöscht",
          description: "Alle gespeicherten Konversationen wurden gelöscht.",
        });
      } else {
        toast({
          title: "Fehler beim Löschen",
          description: "Es gab ein Problem beim Löschen der Konversationen.",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="flex h-screen">
      {/* Overlay for mobile sidebar */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden" 
          onClick={() => setShowSidebar(false)}
        />
      )}
      
      {/* Sidebar for conversations */}
      <div className={`md:w-80 fixed md:static inset-0 z-20 bg-background transition-transform transform md:transform-none ${showSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b md:hidden">
          <h2 className="font-semibold">Konversationen</h2>
          <Button variant="ghost" size="icon" onClick={() => setShowSidebar(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ConversationSidebar 
          conversations={savedConversations}
          currentConversationId={conversation.id}
          onSelectConversation={(conv) => {
            handleSelectConversation(conv);
            if (window.innerWidth < 768) { // Close sidebar on mobile after selection
              setShowSidebar(false);
            }
          }}
          onDeleteConversation={handleDeleteConversation}
          onNewConversation={handleNewConversation}
          onExportConversations={handleExportConversations}
          onImportConversations={handleImportConversations}
          onClearAllConversations={handleClearAllConversations}
          className="h-full md:h-screen"
        />
      </div>
      
      {/* Main chat area */}
      <div className={`flex-1 flex flex-col h-screen ${showSidebar ? 'md:ml-0' : ''}`}>
        {/* Mobile header */}
        <div className="flex items-center justify-between p-2 border-b md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setShowSidebar(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="mr-2"
              onClick={handleSaveConversation}
            >
              <Save className="h-5 w-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <FolderOpen className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Gespeicherte Konversationen</DropdownMenuLabel>
                {savedConversations.length === 0 ? (
                  <DropdownMenuItem disabled>Keine gespeicherten Konversationen</DropdownMenuItem>
                ) : (
                  savedConversations.map(conv => (
                    <DropdownMenuItem 
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                    >
                      {typeof conv.title === 'string' ? conv.title : 'Bildkonversation'}
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleImportConversations}>
                  <Upload className="h-4 w-4 mr-2" />
                  Konversationen importieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportConversations}>
                  <Download className="h-4 w-4 mr-2" />
                  Konversationen exportieren
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleClearAllConversations} 
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Alle Konversationen löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              {models.length > 0 && conversation.messages.length > 0 && (
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1">
                    {selectedModel}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              )}
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Change Model</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {models.map((model) => (
                  <DropdownMenuItem 
                    key={model.name}
                    onClick={() => handleModelChange(model.name)}
                    className="flex items-center justify-between"
                  >
                    {model.name}
                    {model.name === selectedModel && <Check className="h-4 w-4 ml-2" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ThemeToggle />
        </div>

        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="icon">
                <Home className="h-[1.2rem] w-[1.2rem]" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">LocAI Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={handleSaveConversation}
            >
              <Save className="h-4 w-4" />
              Speichern
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <FolderOpen className="h-4 w-4" />
                  Laden
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Gespeicherte Konversationen</DropdownMenuLabel>
                {savedConversations.length === 0 ? (
                  <DropdownMenuItem disabled>Keine gespeicherten Konversationen</DropdownMenuItem>
                ) : (
                  savedConversations.map(conv => (
                    <DropdownMenuItem 
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                    >
                      {typeof conv.title === 'string' ? conv.title : 'Bildkonversation'}
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleImportConversations}>
                  <Upload className="h-4 w-4 mr-2" />
                  Konversationen importieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportConversations}>
                  <Download className="h-4 w-4 mr-2" />
                  Konversationen exportieren
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleClearAllConversations} 
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Alle Konversationen löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              {models.length > 0 && conversation.messages.length > 0 && (
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1">
                    {selectedModel}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              )}
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Change Model</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {models.map((model) => (
                  <DropdownMenuItem 
                    key={model.name}
                    onClick={() => handleModelChange(model.name)}
                    className="flex items-center justify-between"
                  >
                    {model.name}
                    {model.name === selectedModel && <Check className="h-4 w-4 ml-2" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
          </div>
        </div>
      
      <main className="flex-1 flex flex-col overflow-hidden">
          {/* Model selection and system prompt setup if no conversation started */}
        {conversation.messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
              <Card className="w-full max-w-3xl">
              <CardHeader>
                  <CardTitle>Setup Your AI Assistant</CardTitle>
                  <CardDescription>
                    Select a model and customize how it should behave
                  </CardDescription>
              </CardHeader>
              <CardContent>
                {isModelLoading ? (
                  <div className="text-center p-4">
                    <div className="animate-pulse flex space-x-2 justify-center mb-4">
                      <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                      <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                      <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                    </div>
                    <p>Loading available models...</p>
                  </div>
                ) : modelError ? (
                  <div className="text-center text-red-500 p-4">
                    {modelError}
                  </div>
                ) : models.length === 0 ? (
                  <div className="text-center p-4">
                    <p>No models found. Please ensure you have models installed in Ollama.</p>
                  </div>
                ) : (
                    <div className="space-y-6">
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
                          onClick={() => setSelectedModel(model.name)}
                        >
                          {model.name}
                        </Button>
                      ))}
                    </div>
                      </div>
                      
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
                                onClick={resetToDefaultPrompt}
                                title="Reset to default prompt"
                              >
                                <Wand2 className="h-4 w-4 mr-1" />
                                Reset
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                                onClick={() => {
                                  setActiveTab("custom");
                                }}
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
                              onChange={handleCustomPromptChange}
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
                              onChange={handleImagePromptChange}
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
                      onClick={startConversation}
                    disabled={!selectedModel || 
                      (activeTab === "custom" && !customPrompt.trim()) ||
                      (activeTab === "image" && !imagePrompt.trim())}
                    >
                      Start Conversation
                    </Button>
                </CardFooter>
            </Card>
          </div>
        ) : (
          <>
            <ChatContainer conversation={conversation} isLoading={isLoading} />
            <ChatInput onSend={handleSendMessage} disabled={isLoading} />
          </>
        )}
      </main>
      </div>
    </div>
  );
} 