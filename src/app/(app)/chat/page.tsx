"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

// Components
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { SetupCard, IMAGE_PROMPT } from "@/components/chat/SetupCard";
import { ConversationSidebar } from "@/components/chat/sidebar";
import { TokenCounter } from "@/components/chat/TokenCounter";
import { GpuFloatWidget } from "@/components/GpuFloatWidget";
import { ModelPullDialog } from "@/components/ModelPullDialog";
import { RAGToggle } from "@/components/chat/RAGToggle";
import { Button } from "@/components/ui/button";
import { GripVertical } from "lucide-react";

// Hooks
import { useModels } from "@/hooks/useModels";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useDocuments } from "@/hooks/useDocuments";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import { useSettings } from "@/hooks/useSettings";

// Agent Components
import { AgentMessage } from "@/components/chat/AgentMessage";

// Types & Utils
import { Message } from "@/types/chat";
import { getModelSystemContent, deleteOllamaModel } from "@/lib/ollama";
import { useToast } from "@/components/ui/use-toast";
import { IMAGE_ANALYSIS_PROMPT } from "@/lib/prompt-templates";

function ChatPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Settings hook
  const { settings } = useSettings();
  
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
    contextInfo,
    refreshModels
  } = useModels(settings?.ollamaHost);

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

  // Documents / RAG hook
  const {
    ragEnabled,
    toggleRag,
    readyCount: ragReadyCount,
  } = useDocuments();

  const {
    agentTurns,
    isAgentMode,
    toggleAgentMode,
    enabledTools,
    toggleTool,
    isExecutingTool,
    isAgentLoading,
    agentStreamingContent,
    currentTurnIndex,
    totalTurnsEstimate,
    agentError,
    sendAgentMessage,
    cancelAgentRun,
  } = useAgentChat();

  // ── Local UI state ────────────────────────────────────────────
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [showModelPull, setShowModelPull] = useState(false);
  const [showGpuFloat, setShowGpuFloat] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ── Sidebar resize handlers ───────────────────────────────────
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

  // ── Keyboard shortcuts ────────────────────────────────────────
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
        if (isStreaming) stopStreaming();
      },
      description: 'Stop generating'
    },
    {
      key: 'b',
      ctrl: true,
      action: () => setShowSidebar(prev => !prev),
      description: 'Toggle conversation sidebar'
    },
    {
      key: '/',
      action: () => chatInputRef.current?.focus(),
      description: 'Focus chat input'
    }
  ], [isStreaming, stopStreaming]);

  useKeyboardShortcuts(shortcuts);
  
  // ── Prompt state ──────────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────────

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

  // ── Conversation handlers ─────────────────────────────────────

  const handleSaveConversation = useCallback(async () => {
    if (conversation.messages.length <= 1) {
      toast({ title: "Cannot save empty conversation", description: "Add at least one message before saving.", variant: "destructive" });
      return;
    }
    await saveCurrentConversation(generateTitle);
    toast({ title: "Conversation saved", description: "Your conversation has been saved successfully." });
  }, [conversation.messages.length, saveCurrentConversation, generateTitle, toast]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
    toast({ title: "Conversation deleted", description: "The conversation has been deleted." });
  }, [deleteConversation, toast]);

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    await loadConversation(conversationId);
  }, [loadConversation]);

  // After loadConversation sets the conversation state, update model/prompt
  const prevConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Only run when conversation changes and has loaded messages
    if (conversation.id === prevConversationIdRef.current) return;
    prevConversationIdRef.current = conversation.id;

    if (!conversation.messages.some(m => m.isLoaded)) return;

    const systemMsg = conversation.messages.find(m => m.role === 'system');
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
      description: `"${typeof conversation.title === 'string' ? conversation.title : 'Bildkonversation'}" wurde erfolgreich geladen.`,
    });
  }, [conversation, models, setSelectedModel, toast]);

  const handleNewConversation = useCallback(() => {
    createNewConversation();
    clearTokenStats();
  }, [createNewConversation, clearTokenStats]);

  // ── Start conversation ────────────────────────────────────────

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

  // ── Model change during conversation ──────────────────────────

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

  // ── Send message ──────────────────────────────────────────────

  const handleSendMessage = useCallback(async (content: string, images?: File[]) => {
    if (isAgentMode && !images?.length) {
      // Agent mode: send through agent pipeline
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content,
        timestamp: new Date(),
        modelName: selectedModel,
      };
      addMessage(userMessage);

      // Build conversation history for agent context
      const history = conversation.messages.map(msg => ({
        role: msg.role as string,
        content: typeof msg.content === 'string' ? msg.content : '[media content]',
      }));
      history.push({ role: 'user', content });

      const finalContent = await sendAgentMessage(content, {
        conversationHistory: history,
        enabledTools,
        model: selectedModel,
        host: settings?.ollamaHost,
      });

      // Add the final bot message to conversation
      if (finalContent) {
        const botMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: finalContent,
          timestamp: new Date(),
          modelName: selectedModel,
        };
        addMessage(botMessage);
      }
      return;
    }

    // Standard mode
    await sendMessage(
      content,
      images,
      conversation,
      selectedModel,
      (userMsg) => addMessage(userMsg),
      (botMsg) => addMessage(botMsg),
      (newModel) => {
        setSelectedModel(newModel);
        toast({ title: "Verwende Vision-Modell", description: `Bilder werden mit ${newModel} analysiert` });
      },
      visionModels.map(m => m.name),
      undefined, // useStreaming - use default
      { ragEnabled }
    );
  }, [sendMessage, conversation, selectedModel, addMessage, setSelectedModel, visionModels, toast, isAgentMode, sendAgentMessage, enabledTools, ragEnabled, settings?.ollamaHost]);

  // ── Load conversation from URL ────────────────────────────────

  const loadedConversationFromUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const loadId = searchParams.get('load');
    if (!loadId) return;
    if (loadedConversationFromUrlRef.current === loadId) return;

    loadedConversationFromUrlRef.current = loadId;
    handleSelectConversation(loadId);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('load');
    const qs = nextParams.toString();
    router.replace(qs ? `/chat?${qs}` : '/chat', { scroll: false });
  }, [searchParams, router, handleSelectConversation]);

  // ── Image analysis from gallery ───────────────────────────────

  useEffect(() => {
    const shouldAnalyze = searchParams.get('analyzeImage');
    if (shouldAnalyze && hasVisionModel && visionModels.length > 0) {
      const storedData = sessionStorage.getItem('analyzeImage');
      if (storedData) {
        try {
          const { imageUrl, filename } = JSON.parse(storedData);
          sessionStorage.removeItem('analyzeImage');
          
          const visionModel = visionModels[0]?.name;
          if (visionModel) {
            setSelectedModel(visionModel);
            const systemMessage: Message = {
              id: uuidv4(),
              role: "system",
              content: IMAGE_ANALYSIS_PROMPT,
              timestamp: new Date(),
              modelName: visionModel
            };
            setConversation(prev => ({
              ...prev,
              id: uuidv4(),
              title: `Bildanalyse: ${filename}`,
              messages: [systemMessage],
              createdAt: new Date(),
              updatedAt: new Date()
            }));
            
            fetch(imageUrl)
              .then(res => res.blob())
              .then(blob => {
                const file = new File([blob], filename, { type: blob.type || 'image/png' });
                setTimeout(() => {
                  handleSendMessage(`Bitte analysiere dieses Bild: ${filename}`, [file]);
                }, 100);
              })
              .catch(err => {
                console.error('Failed to fetch image for analysis:', err);
                toast({ title: "Fehler beim Laden des Bildes", description: "Das Bild konnte nicht geladen werden.", variant: "destructive" });
              });
          }
        } catch (err) {
          console.error('Failed to parse analyze image data:', err);
        }
      }
    }
  }, [searchParams, hasVisionModel, visionModels, setSelectedModel, setConversation, handleSendMessage, toast]);

  // ── Import/Export handlers ────────────────────────────────────

  const handleExportConversations = useCallback(async () => {
    const result = await exportConversations();
    toast({
      title: result ? "Export erfolgreich" : "Export fehlgeschlagen",
      description: result ? "Alle Konversationen wurden erfolgreich exportiert." : "Es gab ein Problem beim Exportieren.",
      variant: result ? "default" : "destructive"
    });
  }, [exportConversations, toast]);

  const handleImportConversations = useCallback(async () => {
    const result = await importConversations();
    toast({
      title: result.success ? "Import erfolgreich" : "Import fehlgeschlagen",
      description: result.success ? `${result.count} neue Konversationen wurden importiert.` : "Es gab ein Problem beim Importieren.",
      variant: result.success ? "default" : "destructive"
    });
  }, [importConversations, toast]);

  const handleClearAllConversations = useCallback(async () => {
    if (window.confirm("Sind Sie sicher, dass Sie ALLE gespeicherten Konversationen löschen möchten?")) {
      const success = await clearAllConversations();
      if (success) {
        toast({ title: "Konversationen gelöscht", description: "Alle gespeicherten Konversationen wurden gelöscht." });
      }
    }
  }, [clearAllConversations, toast]);

  // ── Prompt handlers ───────────────────────────────────────────

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

  // ── Derived state ─────────────────────────────────────────────

  const hasConversationStarted = conversation.messages.length > 0;

  // Build compact token stats for header
  const headerTokenStats = useMemo(() => {
    if (!tokenStats) return null;
    return {
      totalTokens: (tokenStats.promptTokens ?? 0) + (tokenStats.completionTokens ?? 0),
      tokensPerSecond: tokenStats.tokensPerSecond ?? 0,
    };
  }, [tokenStats]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Conversation Sidebar ─────────────────────────────────── */}
      {showSidebar && (
        <div 
          ref={sidebarRef}
          style={{ width: `${sidebarWidth}px` }}
          className={`relative border-r border-border/60 bg-sidebar/50 ${isResizing ? 'select-none' : ''}`}
        >
          <ConversationSidebar 
            conversations={savedConversations}
            currentConversationId={conversation.id}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onNewConversation={handleNewConversation}
            onUpdateConversationTags={updateConversationTags}
            className="h-full"
          />
          
          {/* Resize Handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-primary/30 transition-colors group flex items-center justify-center"
            onMouseDown={startResizing}
          >
            <div className="absolute right-0 w-4 h-full" />
            <GripVertical className="h-5 w-5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      )}
      
      {/* ── Main chat area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <ChatHeader
          models={models}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          showModelSelector={hasConversationStarted}
          onPullModel={() => setShowModelPull(true)}
          conversationTitle={hasConversationStarted ? conversation.title : undefined}
          savedConversations={savedConversations}
          onSaveConversation={handleSaveConversation}
          onSelectConversation={handleSelectConversation}
          onImportConversations={handleImportConversations}
          onExportConversations={handleExportConversations}
          onClearAllConversations={handleClearAllConversations}
          onToggleSidebar={() => setShowSidebar(prev => !prev)}
          showSidebarToggle={true}
          isSidebarOpen={showSidebar}
          tokenStats={headerTokenStats}
          onToggleGpuFloat={() => setShowGpuFloat(prev => !prev)}
        />

        {/* Main content */}
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
              <ChatContainer conversation={conversation} isLoading={isChatLoading && !isAgentMode} />

              {/* Agent message (tool calls + streaming) */}
              {isAgentMode && (isAgentLoading || agentTurns.length > 0) && (
                <div className="px-4 lg:px-8">
                  <AgentMessage
                    turns={agentTurns}
                    content={agentStreamingContent}
                    isLoading={isAgentLoading}
                    isExecutingTool={isExecutingTool}
                    currentTurnIndex={currentTurnIndex}
                    totalTurnsEstimate={totalTurnsEstimate}
                    modelName={selectedModel}
                    error={agentError}
                  />
                </div>
              )}

              {/* Token Counter */}
              {tokenStats && (
                <div className="px-4 py-2 border-t border-border/40">
                  <TokenCounter 
                    stats={tokenStats} 
                    contextLimit={contextInfo?.contextLength || 128000}
                    compact 
                  />
                </div>
              )}
              
              {/* Stop Button */}
              {(isStreaming || isAgentLoading) && (
                <div className="px-4 py-2 border-t border-border/40 flex justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={isAgentLoading ? cancelAgentRun : stopStreaming}
                    className="text-destructive hover:text-destructive"
                  >
                    {isAgentLoading ? 'Agent stoppen' : 'Stop Generating'}
                  </Button>
                </div>
              )}
              
              {/* Chat Input */}
              <div className="px-4 pb-6">
                {/* RAG + Agent toggles row */}
                <div className="flex items-center gap-1 mb-1 ml-1">
                  <RAGToggle
                    enabled={ragEnabled}
                    onToggle={toggleRag}
                    readyCount={ragReadyCount}
                    disabled={isChatLoading || isAgentLoading}
                  />
                </div>
                <ChatInput 
                  onSend={handleSendMessage} 
                  disabled={isChatLoading || isAgentLoading} 
                  inputRef={chatInputRef}
                  searxngUrl={settings?.searxngUrl}
                  searxngEnabled={settings?.searxngEnabled}
                  ollamaHost={settings?.ollamaHost}
                  selectedModel={selectedModel}
                  agentMode={isAgentMode}
                  onToggleAgentMode={toggleAgentMode}
                  enabledTools={enabledTools}
                  onToggleTool={toggleTool}
                />
              </div>
            </>
          )}
        </main>
      </div>
      
      {/* ── Model Pull Dialog ────────────────────────────────────── */}
      <ModelPullDialog
        isOpen={showModelPull}
        onClose={() => setShowModelPull(false)}
        host={settings?.ollamaHost}
        installedModels={models.map(m => m.name)}
        installedModelsDetails={models}
        onModelPulled={(modelName) => {
          toast({ title: 'Modell installiert', description: `${modelName} wurde erfolgreich heruntergeladen.` });
          refreshModels();
        }}
        onDeleteModel={async (modelName) => {
          await deleteOllamaModel(modelName, settings?.ollamaHost);
          toast({ title: 'Modell gelöscht', description: `${modelName} wurde erfolgreich entfernt.` });
          refreshModels();
        }}
      />

      {/* ── GPU Float Widget (replaces RightSidebar) ─────────────── */}
      <GpuFloatWidget
        isOpen={showGpuFloat}
        onToggle={() => setShowGpuFloat(prev => !prev)}
        isGenerating={isChatLoading}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
