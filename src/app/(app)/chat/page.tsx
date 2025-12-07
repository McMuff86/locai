"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

// Components
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { SetupCard, IMAGE_PROMPT } from "@/components/chat/SetupCard";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { TokenCounter } from "@/components/chat/TokenCounter";
import { SystemMonitor } from "@/components/SystemMonitor";
import { RightSidebar } from "@/components/RightSidebar";
import { ModelPullDialog } from "@/components/ModelPullDialog";
import { Button } from "@/components/ui/button";
import { X, GripVertical } from "lucide-react";

// Hooks
import { useModels } from "@/hooks/useModels";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import { useSettings } from "@/hooks/useSettings";

// Types & Utils
import { Message } from "@/types/chat";
import { getModelSystemContent } from "@/lib/ollama";
import { useToast } from "@/components/ui/use-toast";
import { IMAGE_ANALYSIS_PROMPT } from "@/lib/prompt-templates";

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
    updateConversationTitle,
    updateConversationTags
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
  const [showConversationSidebar, setShowConversationSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [showModelPull, setShowModelPull] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
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
      const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left + sidebarRef.current.offsetLeft;
      if (newWidth >= 200 && newWidth <= 450) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

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
      action: () => setShowConversationSidebar(prev => !prev),
      description: 'Toggle conversation sidebar'
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
  const [activeTab, setActiveTab] = useState<string>("templates");
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
  }, [loadConversation, models, setSelectedModel, toast]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    createNewConversation();
    clearTokenStats();
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
      case "templates":
        systemContent = customPrompt || defaultPrompt;
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
    <div className="flex h-full overflow-hidden">
      {/* Conversation Sidebar */}
      {showConversationSidebar && (
        <div 
          ref={sidebarRef}
          style={{ width: `${sidebarWidth}px` }}
          className={`relative border-r border-border bg-sidebar/50 ${isResizing ? 'select-none' : ''}`}
        >
          <ConversationSidebar 
            conversations={savedConversations}
            currentConversationId={conversation.id}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onNewConversation={handleNewConversation}
            onExportConversations={handleExportConversations}
            onImportConversations={handleImportConversations}
            onClearAllConversations={handleClearAllConversations}
            onUpdateConversationTags={updateConversationTags}
            settings={settings}
            onUpdateSettings={updateSettings}
            onPullModel={() => setShowModelPull(true)}
            className="h-full"
          />
          
          {/* Resize Handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-border hover:bg-primary/50 transition-colors group flex items-center justify-center"
            onMouseDown={startResizing}
          >
            <div className="absolute right-0 w-4 h-full" />
            <GripVertical className="h-6 w-6 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      )}
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with model selector */}
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
          onToggleSidebar={() => setShowConversationSidebar(prev => !prev)}
          showSidebarToggle={true}
          isSidebarOpen={showConversationSidebar}
        />

        {/* System Monitor - Click to open right sidebar with GPU Monitor */}
        <div className="px-4 py-2 border-b flex items-center gap-2">
          <button 
            onClick={() => setShowRightSidebar(true)}
            className="flex-1 text-left hover:bg-accent/50 rounded-lg transition-colors cursor-pointer"
            title="Click to open GPU Monitor panel"
          >
            <SystemMonitor isGenerating={isChatLoading} compact />
          </button>
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
        }}
      />

      {/* Right Sidebar - GPU Monitor & Tools */}
      <RightSidebar
        isOpen={showRightSidebar}
        onToggle={() => setShowRightSidebar(!showRightSidebar)}
        isGenerating={isChatLoading}
      />
    </div>
  );
}

