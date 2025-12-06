"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

// Components
import { ChatContainer } from "../../components/chat/ChatContainer";
import { ChatInput } from "../../components/chat/ChatInput";
import { ChatHeader } from "../../components/chat/ChatHeader";
import { SetupCard, IMAGE_PROMPT } from "../../components/chat/SetupCard";
import { ConversationSidebar } from "../../components/chat/ConversationSidebar";
import { TokenCounter } from "../../components/chat/TokenCounter";
import { SystemMonitor } from "../../components/SystemMonitor";
import { ImageGallery } from "../../components/ImageGallery";
import { ModelPullDialog } from "../../components/ModelPullDialog";
import { Button } from "../../components/ui/button";
import { X, GripVertical } from "lucide-react";

// Hooks
import { useModels } from "../../hooks/useModels";
import { useConversations } from "../../hooks/useConversations";
import { useChat } from "../../hooks/useChat";
import { useKeyboardShortcuts, KeyboardShortcut } from "../../hooks/useKeyboardShortcuts";
import { useSettings } from "../../hooks/useSettings";

// Types & Utils
import { Message } from "../../types/chat";
import { getModelSystemContent } from "../../lib/ollama";
import { useToast } from "../../components/ui/use-toast";

export default function ChatPage() {
  const { toast } = useToast();
  
  // Settings hook
  const { settings, updateSettings } = useSettings();
  
  // Custom hooks
  const {
    models,
    selectedModel,
    setSelectedModel,
    isLoading: isModelLoading,
    error: modelError,
    hasVisionModel,
    visionModels,
    getSystemPrompt,
    contextInfo
  } = useModels();

  const {
    conversation,
    setConversation,
    savedConversations,
    createNewConversation,
    saveCurrentConversation,
    deleteConversation,
    loadConversation,
    exportConversations,
    importConversations,
    clearAllConversations,
    addMessage,
    updateConversationTitle
  } = useConversations();

  const {
    isLoading: isChatLoading,
    isStreaming,
    tokenStats,
    sendMessage,
    clearTokenStats,
    stopStreaming
  } = useChat();

  // Local UI state
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400); // Default 400px
  const [isResizing, setIsResizing] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showModelPull, setShowModelPull] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Sidebar resize handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const newWidth = e.clientX;
      // Constrain between 240px and 500px
      if (newWidth >= 240 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  // Add/remove resize event listeners
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(() => [
    {
      key: 'n',
      ctrl: true,
      action: () => handleNewConversation(),
      description: 'New conversation'
    },
    {
      key: 's',
      ctrl: true,
      action: () => handleSaveConversation(),
      description: 'Save conversation'
    },
    {
      key: 'Escape',
      action: () => {
        if (isStreaming) {
          stopStreaming();
        }
      },
      description: 'Stop generating'
    },
    {
      key: 'b',
      ctrl: true,
      action: () => setShowSidebar(prev => !prev),
      description: 'Toggle sidebar'
    },
    {
      key: '/',
      action: () => chatInputRef.current?.focus(),
      description: 'Focus chat input'
    }
  ], [isStreaming, stopStreaming]);

  useKeyboardShortcuts(shortcuts);
  
  // Prompt state
  const [defaultPrompt, setDefaultPrompt] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [imagePrompt, setImagePrompt] = useState<string>(IMAGE_PROMPT);
  const [activeTab, setActiveTab] = useState<string>("default");
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);

  // Update default prompt when model changes
  useEffect(() => {
    if (selectedModel) {
      const systemPrompt = getSystemPrompt(selectedModel);
      setDefaultPrompt(systemPrompt);
      if (!isEditingPrompt) {
        setCustomPrompt(systemPrompt);
      }
    }
  }, [selectedModel, getSystemPrompt, isEditingPrompt]);

  // Check for vision model availability
  useEffect(() => {
    if (!hasVisionModel && models.length > 0) {
      toast({
        title: "Vision-Modell nicht gefunden",
        description: "Um Bilder analysieren zu können, führen Sie bitte 'ollama pull llama3.2-vision' aus.",
        variant: "default",
        duration: 10000,
      });
    }
  }, [hasVisionModel, models.length, toast]);

  // Generate title from first user message
  const generateTitle = useCallback((conv: typeof conversation) => {
    if (conv.title !== "New Conversation" && !conv.title.startsWith("Chat with")) {
      return conv.title;
    }
    
    const firstUserMessage = conv.messages.find(msg => msg.role === 'user');
    if (firstUserMessage) {
      const content = firstUserMessage.content;
      
      if (typeof content === 'string') {
        return content.length > 30 ? `${content.substring(0, 30)}...` : content;
      } else if (Array.isArray(content)) {
        const firstText = content.find(item => typeof item === 'string');
        if (firstText && typeof firstText === 'string') {
          return firstText.length > 30 ? `${firstText.substring(0, 30)}...` : firstText;
        }
        return "Bildanalyse-Konversation";
      }
      return "Bildanalyse-Konversation";
    }
    return conv.title;
  }, []);

  // Handle save conversation
  const handleSaveConversation = useCallback(() => {
    if (conversation.messages.length <= 1) {
      toast({
        title: "Cannot save empty conversation",
        description: "Add at least one message before saving.",
        variant: "destructive"
      });
      return;
    }
    
    if (saveCurrentConversation(generateTitle)) {
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
  }, [conversation.messages.length, saveCurrentConversation, generateTitle, toast]);

  // Handle delete conversation
  const handleDeleteConversation = useCallback((id: string) => {
    if (deleteConversation(id)) {
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
  }, [deleteConversation, toast]);

  // Handle load conversation
  const handleSelectConversation = useCallback((conv: typeof conversation) => {
    loadConversation(conv);
    
    // Restore model and prompt settings
    const systemMsg = conv.messages.find(m => m.role === 'system');
    if (systemMsg && systemMsg.modelName && models.some(m => m.name === systemMsg.modelName)) {
      setSelectedModel(systemMsg.modelName);
      
      const defaultSystemContent = getModelSystemContent(systemMsg.modelName);
      if (typeof systemMsg.content === 'string') {
        if (systemMsg.content !== defaultSystemContent) {
          setCustomPrompt(systemMsg.content);
          setIsEditingPrompt(true);
        } else {
          setCustomPrompt(defaultSystemContent);
          setIsEditingPrompt(false);
        }
      }
    }
    
    toast({
      title: "Konversation geladen",
      description: `"${typeof conv.title === 'string' ? conv.title : 'Bildkonversation'}" wurde erfolgreich geladen.`,
    });
    
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  }, [loadConversation, models, setSelectedModel, toast]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    createNewConversation();
    clearTokenStats();
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  }, [createNewConversation, clearTokenStats]);

  // Start conversation with system message
  const handleStartConversation = useCallback(() => {
    if (!selectedModel) return;

    let systemContent: string;
    switch (activeTab) {
      case "image":
        systemContent = imagePrompt;
        break;
      case "custom":
        systemContent = customPrompt;
        break;
      default:
        systemContent = defaultPrompt;
        break;
    }

    const systemMessage: Message = {
      id: uuidv4(),
      role: "system",
      content: systemContent,
      timestamp: new Date(),
      modelName: selectedModel
    };

    setConversation(prev => ({
      ...prev,
      title: `Chat with ${selectedModel}`,
      messages: [systemMessage],
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    setIsEditingPrompt(false);
  }, [selectedModel, activeTab, imagePrompt, customPrompt, defaultPrompt, setConversation]);

  // Handle model change during conversation
  const handleModelChange = useCallback((newModel: string) => {
    if (newModel === selectedModel) return;
    
    const systemMessage: Message = {
      id: uuidv4(),
      role: "system",
      content: `Switching to model: ${newModel}. Previous context is maintained, but response style may change based on the new model's capabilities.`,
      timestamp: new Date(),
      modelName: newModel
    };
    
    addMessage(systemMessage);
    updateConversationTitle(`Chat with ${newModel}`);
    setSelectedModel(newModel);
  }, [selectedModel, addMessage, updateConversationTitle, setSelectedModel]);

  // Handle analyze image from gallery
  const handleAnalyzeGalleryImage = useCallback(async (imageUrl: string, filename: string) => {
    // Check if we have a vision model
    if (visionModels.length === 0) {
      toast({
        title: "Kein Vision-Modell verfügbar",
        description: "Bitte installieren Sie ein Vision-Modell mit 'ollama pull granite3.2-vision'",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Fetch the image and convert to File
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type });
      
      // Prefer granite3.2-vision, then llama3.2-vision, then first available
      const currentModelIsVision = visionModels.some(vm => vm.name === selectedModel);
      let modelToUse = selectedModel;
      
      if (!currentModelIsVision) {
        // Priority: granite3.2-vision > llama3.2-vision > first available
        const graniteVision = visionModels.find(vm => vm.name.includes('granite') && vm.name.includes('vision'));
        const llamaVision = visionModels.find(vm => vm.name.includes('llama') && vm.name.includes('vision'));
        
        modelToUse = graniteVision?.name || llamaVision?.name || visionModels[0].name;
        setSelectedModel(modelToUse);
        toast({
          title: "Vision-Modell ausgewählt",
          description: `Wechsel zu ${modelToUse} für Bildanalyse.`,
        });
      }
      
      // Start new conversation if needed
      if (conversation.messages.length === 0) {
        // Start conversation with system message
        const systemContent = imagePrompt;
        
        const systemMessage: Message = {
          id: uuidv4(),
          role: 'system',
          content: systemContent,
          timestamp: new Date(),
          modelName: modelToUse
        };
        
        addMessage(systemMessage);
        updateConversationTitle(`Image Analysis: ${filename}`);
      }
      
      // Small delay to ensure system message is processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send the image with detailed analysis request in English
      const analysisPrompt = `Please analyze this image in detail. Describe:
1. The main subject and composition
2. Colors, lighting, and visual style
3. Technical aspects (if it's AI-generated: apparent model, quality, artifacts)
4. Mood and atmosphere
5. Any text, symbols, or notable elements

Image filename: ${filename}`;
      
      await sendMessage(
        analysisPrompt,
        [file],
        conversation,
        modelToUse,
        (userMsg) => addMessage(userMsg),
        (botMsg) => addMessage(botMsg),
        (newModel) => {
          setSelectedModel(newModel);
        }
      );
      
    } catch (err) {
      console.error('Failed to analyze image:', err);
      toast({
        title: "Fehler bei der Bildanalyse",
        description: "Das Bild konnte nicht geladen werden.",
        variant: "destructive"
      });
    }
  }, [visionModels, selectedModel, conversation, imagePrompt, sendMessage, addMessage, updateConversationTitle, toast, setSelectedModel]);

  // Handle send message
  const handleSendMessage = useCallback(async (content: string, images?: File[]) => {
    await sendMessage(
      content,
      images,
      conversation,
      selectedModel,
      (userMsg) => addMessage(userMsg),
      (botMsg) => addMessage(botMsg),
      (newModel) => {
        setSelectedModel(newModel);
        toast({
          title: "Verwende Vision-Modell",
          description: `Bilder werden mit ${newModel} analysiert`,
        });
      },
      visionModels.map(m => m.name)
    );
  }, [sendMessage, conversation, selectedModel, addMessage, setSelectedModel, visionModels, toast]);

  // Handle import/export
  const handleExportConversations = useCallback(async () => {
    const result = await exportConversations();
    toast({
      title: result ? "Export erfolgreich" : "Export fehlgeschlagen",
      description: result 
        ? "Alle Konversationen wurden erfolgreich exportiert."
        : "Es gab ein Problem beim Exportieren.",
      variant: result ? "default" : "destructive"
    });
  }, [exportConversations, toast]);

  const handleImportConversations = useCallback(async () => {
    const result = await importConversations();
    toast({
      title: result.success ? "Import erfolgreich" : "Import fehlgeschlagen",
      description: result.success 
        ? `${result.count} neue Konversationen wurden importiert.`
        : "Es gab ein Problem beim Importieren.",
      variant: result.success ? "default" : "destructive"
    });
  }, [importConversations, toast]);

  const handleClearAllConversations = useCallback(() => {
    if (window.confirm("Sind Sie sicher, dass Sie ALLE gespeicherten Konversationen löschen möchten?")) {
      if (clearAllConversations()) {
        toast({
          title: "Konversationen gelöscht",
          description: "Alle gespeicherten Konversationen wurden gelöscht.",
        });
      }
    }
  }, [clearAllConversations, toast]);

  // Prompt handlers
  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value);
    setIsEditingPrompt(true);
  };

  const handleImagePromptChange = (value: string) => {
    setImagePrompt(value);
    setIsEditingPrompt(true);
  };

  const handleResetPrompt = () => {
    if (activeTab === "image") {
      setImagePrompt(IMAGE_PROMPT);
    } else {
      setCustomPrompt(defaultPrompt);
    }
    setIsEditingPrompt(false);
  };

  const hasConversationStarted = conversation.messages.length > 0;

  return (
    <div className="flex h-screen">
      {/* Overlay for mobile sidebar */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden" 
          onClick={() => setShowSidebar(false)}
        />
      )}
      
      {/* Sidebar - Always visible on desktop (md+), toggle on mobile */}
      <div 
        ref={sidebarRef}
        style={{ width: `${sidebarWidth}px` }}
        className={`fixed md:relative inset-y-0 left-0 z-20 bg-sidebar transition-transform duration-300 ease-in-out ${showSidebar ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${isResizing ? 'select-none' : ''}`}
      >
        <div className="flex items-center justify-between p-4 border-b md:hidden">
          <h2 className="font-semibold">Konversationen</h2>
          <Button variant="ghost" size="icon" onClick={() => setShowSidebar(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ConversationSidebar 
          conversations={savedConversations}
          currentConversationId={conversation.id}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewConversation={handleNewConversation}
          onExportConversations={handleExportConversations}
          onImportConversations={handleImportConversations}
          onClearAllConversations={handleClearAllConversations}
          settings={settings}
          onUpdateSettings={updateSettings}
          onOpenGallery={() => setShowGallery(true)}
          onPullModel={() => setShowModelPull(true)}
          className="h-full md:h-screen"
        />
        
        {/* Resize Handle - Desktop only */}
        <div
          className="hidden md:flex absolute top-0 right-0 w-1 h-full cursor-col-resize bg-border hover:bg-primary/50 transition-colors group items-center justify-center"
          onMouseDown={startResizing}
        >
          <div className="absolute right-0 w-4 h-full" /> {/* Larger hit area */}
          <GripVertical className="h-6 w-6 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Mobile Header */}
        <ChatHeader
          models={models}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          showModelSelector={hasConversationStarted}
          onPullModel={() => setShowModelPull(true)}
          savedConversations={savedConversations}
          onSaveConversation={handleSaveConversation}
          onSelectConversation={handleSelectConversation}
          onImportConversations={handleImportConversations}
          onExportConversations={handleExportConversations}
          onClearAllConversations={handleClearAllConversations}
          onToggleSidebar={() => setShowSidebar(true)}
          isMobile={true}
        />

        {/* Desktop Header */}
        <ChatHeader
          models={models}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          showModelSelector={hasConversationStarted}
          onPullModel={() => setShowModelPull(true)}
          savedConversations={savedConversations}
          onSaveConversation={handleSaveConversation}
          onSelectConversation={handleSelectConversation}
          onImportConversations={handleImportConversations}
          onExportConversations={handleExportConversations}
          onClearAllConversations={handleClearAllConversations}
        />

        {/* System Monitor */}
        <div className="hidden md:block px-4 py-2 border-b">
          <SystemMonitor isGenerating={isChatLoading} compact />
        </div>
      
        <main className="flex-1 flex flex-col overflow-hidden">
          {!hasConversationStarted ? (
            <SetupCard
              models={models}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              isLoading={isModelLoading}
              error={modelError}
              defaultPrompt={defaultPrompt}
              customPrompt={customPrompt}
              imagePrompt={imagePrompt}
              activeTab={activeTab}
              isEditingPrompt={isEditingPrompt}
              onCustomPromptChange={handleCustomPromptChange}
              onImagePromptChange={handleImagePromptChange}
              onTabChange={setActiveTab}
              onResetPrompt={handleResetPrompt}
              onStartConversation={handleStartConversation}
            />
          ) : (
            <>
              <ChatContainer conversation={conversation} isLoading={isChatLoading} />
              
              {/* Token Counter */}
              {/* Token Counter with Context Info */}
              {tokenStats && (
                <div className="px-4 py-2 border-t">
                  <TokenCounter 
                    stats={tokenStats} 
                    contextLimit={contextInfo?.contextLength || 128000}
                    compact 
                  />
                </div>
              )}
              
              {/* Stop Button for Streaming */}
              {isStreaming && (
                <div className="px-4 py-2 border-t flex justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={stopStreaming}
                    className="text-destructive hover:text-destructive"
                  >
                    Stop Generating
                  </Button>
                </div>
              )}
              
              {/* Chat Input with bottom padding */}
              <div className="px-4 pb-6">
                <ChatInput 
                  onSend={handleSendMessage} 
                  disabled={isChatLoading} 
                  inputRef={chatInputRef}
                />
              </div>
            </>
          )}
        </main>
      </div>
      
      {/* Image Gallery Modal */}
      <ImageGallery
        comfyUIPath={settings.comfyUIPath}
        outputPath={settings.comfyUIOutputPath}
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        onAnalyzeImage={handleAnalyzeGalleryImage}
        onShowToast={(title, description, variant) => {
          toast({ title, description, variant: variant || 'default' });
        }}
      />
      
      {/* Model Pull Dialog */}
      <ModelPullDialog
        isOpen={showModelPull}
        onClose={() => setShowModelPull(false)}
        installedModels={models.map(m => m.name)}
        onModelPulled={(modelName) => {
          toast({
            title: 'Modell installiert',
            description: `${modelName} wurde erfolgreich heruntergeladen.`,
          });
          // Refresh models list - the useModels hook should auto-refresh
        }}
      />
    </div>
  );
}
