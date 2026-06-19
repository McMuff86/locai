"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

// Components
import { ChatHeader } from "@/components/chat/ChatHeader";
import { SetupCard, IMAGE_PROMPT } from "@/components/chat/SetupCard";
import { ConversationSidebar } from "@/components/chat/sidebar";
import { RAGToggle } from "@/components/chat/RAGToggle";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Check,
  GripVertical,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Hooks
import { useModels } from "@/hooks/useModels";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useWorkflowChat, checkActiveWorkflow } from "@/hooks/useWorkflowChat";
import { useDocuments } from "@/hooks/useDocuments";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import { useSettings } from "@/hooks/useSettings";

// Types & Utils
import { Message } from "@/types/chat";
import { getModelSystemContent, deleteOllamaModel } from "@/lib/ollama";
import { useToast } from "@/components/ui/use-toast";
import { IMAGE_ANALYSIS_PROMPT } from "@/lib/prompt-templates";
import type {
  ToolCapabilityScope,
  WorkspaceArtifact,
  WorkspaceArtifactWithContent,
  WorkspaceProject,
} from "@/lib/workspace/types";

const ModelPullDialog = dynamic(
  () => import("@/components/ModelPullDialog").then((mod) => mod.ModelPullDialog),
  { loading: () => null },
);

const ChatContainer = dynamic(
  () => import("@/components/chat/ChatContainer").then((mod) => mod.ChatContainer),
  { loading: () => null },
);

const ChatInput = dynamic(
  () => import("@/components/chat/ChatInput").then((mod) => mod.ChatInput),
  { loading: () => null },
);

const TokenCounter = dynamic(
  () => import("@/components/chat/TokenCounter").then((mod) => mod.TokenCounter),
  { loading: () => null },
);

const GpuFloatWidget = dynamic(
  () => import("@/components/GpuFloatWidget").then((mod) => mod.GpuFloatWidget),
  { loading: () => null },
);

const AgentMessage = dynamic(
  () => import("@/components/chat/AgentMessage").then((mod) => mod.AgentMessage),
  { loading: () => null },
);

const WorkflowProgress = dynamic(
  () => import("@/components/chat/WorkflowProgress").then((mod) => mod.WorkflowProgress),
  { loading: () => null },
);

const OPEN_FILE_IN_AGENT_SESSION_KEY = 'openFileInAgent';

interface OpenFileInAgentPayload {
  rootId: string;
  relativePath: string;
  filename: string;
  previewSnippet: string;
  previewTruncated: boolean;
}

interface WorkspaceProjectsResponse {
  success: boolean;
  projects?: WorkspaceProject[];
  error?: string;
}

interface WorkspaceArtifactsResponse {
  success: boolean;
  artifacts?: WorkspaceArtifact[];
  error?: string;
}

interface WorkspaceArtifactResponse {
  success: boolean;
  artifact?: WorkspaceArtifactWithContent;
  error?: string;
}

const NO_WORKSPACE_PROJECT = '__no_workspace_project__';
const NO_WORKSPACE_ARTIFACT = '__no_workspace_artifact__';

const APPROVAL_SCOPE_OPTIONS: Array<{ scope: ToolCapabilityScope; label: string }> = [
  { scope: 'read_local_files', label: 'Read' },
  { scope: 'write_local_files', label: 'Write' },
  { scope: 'network_read', label: 'Net' },
  { scope: 'shell_command', label: 'Shell' },
  { scope: 'code_execution', label: 'Code' },
];

async function fetchWorkspaceJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }
  return data as T;
}

function summarizeTextForTitle(content: string): string {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || 'Agent Antwort';
  return firstLine.length > 72 ? `${firstLine.slice(0, 72)}...` : firstLine;
}

function buildCapturedArtifactContent(
  prompt: string,
  answer: string,
  model?: string,
  sourceLabel = 'Agent Antwort',
): string {
  const modelLine = model ? `\nModel: ${model}\n` : '';
  return [
    `# ${summarizeTextForTitle(prompt)}`,
    '',
    '## Prompt',
    '',
    prompt,
    '',
    `## ${sourceLabel}`,
    '',
    answer,
    modelLine,
  ].join('\n');
}

function buildOpenFileAgentPrompt(payload: OpenFileInAgentPayload): string {
  const rootLabel =
    payload.rootId === 'workspace'
      ? 'Agent Workspace'
      : payload.rootId === 'locai'
        ? 'LocAI Daten'
        : payload.rootId === 'documents'
          ? 'Dokumente'
          : payload.rootId;

  const toolHint =
    payload.rootId === 'workspace'
      ? `Nutze das Tool read_file mit path "${payload.relativePath}".`
      : 'Versuche die Datei bei Bedarf mit read_file zu lesen und nutze den Vorschauauszug als Fallback-Kontext.';

  const snippet = payload.previewSnippet?.trim();
  const snippetBlock = snippet
    ? [
      'Vorschauauszug:',
      '```',
      snippet,
      '```',
    ].join('\n')
    : 'Kein Vorschauauszug verfügbar.';

  return [
    'Bitte analysiere diese Datei aus dem Dateibrowser.',
    `Datei: ${payload.filename}`,
    `Root: ${rootLabel} (${payload.rootId})`,
    `Pfad: ${payload.relativePath}`,
    '',
    `Tool-Hinweis: ${toolHint}`,
    payload.previewTruncated
      ? 'Hinweis: Der Vorschauauszug ist gekürzt. Nutze für vollständige Analyse bevorzugt read_file.'
      : 'Hinweis: Der Vorschauauszug entspricht dem geladenen Preview-Inhalt.',
    '',
    snippetBlock,
  ].join('\n');
}

function ChatPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
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
    setRagEnabled,
    uploadDocument: uploadRagDocument,
    readyCount: ragReadyCount,
  } = useDocuments({ pollIntervalMs: 0 });

  const {
    agentTurns,
    isAgentMode,
    toggleAgentMode,
    setIsAgentMode,
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
    activePreset,
    selectPreset,
    enablePlanning,
    togglePlanning,
    agentPlan,
    memoryContext,
  } = useAgentChat();

  // Workflow Engine hook (Sprint 5)
  const {
    workflowState,
    isRunning: isWorkflowRunning,
    enableReflection,
    toggleReflection,
    sendWorkflowMessage,
    cancelWorkflow,
    resetWorkflow,
    restoreWorkflowState,
  } = useWorkflowChat();
  const [workflowMode, setWorkflowMode] = useState(false);
  const toggleWorkflowMode = useCallback(() => setWorkflowMode((p) => !p), []);

  // Workflow resume dialog state
  const [pendingResumeState, setPendingResumeState] = useState<import('@/lib/agents/workflowTypes').WorkflowState | null>(null);
  const resumeCheckedRef = useRef(false);

  // ── Check for active workflow to resume on mount ──────────────
  useEffect(() => {
    if (resumeCheckedRef.current || !conversation.id) return;
    resumeCheckedRef.current = true;

    checkActiveWorkflow(conversation.id).then((state) => {
      if (state) {
        setPendingResumeState(state);
      }
    }).catch(() => {
      // Ignore IndexedDB errors
    });
  }, [conversation.id]);

  // Reset resume check when conversation changes
  useEffect(() => {
    resumeCheckedRef.current = false;
    setPendingResumeState(null);
  }, [conversation.id]);

  const handleResumeWorkflow = useCallback(() => {
    if (!pendingResumeState) return;
    setWorkflowMode(true);
    restoreWorkflowState(pendingResumeState);
    setPendingResumeState(null);
  }, [pendingResumeState, restoreWorkflowState]);

  const handleDiscardWorkflow = useCallback(async () => {
    if (pendingResumeState?.conversationId) {
      const { clearActiveWorkflow: clearIdb } = await import('@/lib/agents/workflowPersistence');
      await clearIdb(pendingResumeState.conversationId).catch(() => {});
    }
    setPendingResumeState(null);
  }, [pendingResumeState]);

  // ── Local UI state ────────────────────────────────────────────
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(settings?.sidebarWidth ?? 320);
  const [isResizing, setIsResizing] = useState(false);
  const [showModelPull, setShowModelPull] = useState(false);
  const [showGpuFloat, setShowGpuFloat] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState('');
  const [prefillVersion, setPrefillVersion] = useState(0);
  const [pendingOpenFilePrompt, setPendingOpenFilePrompt] = useState<string | null>(null);
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProject[]>([]);
  const [workspaceArtifacts, setWorkspaceArtifacts] = useState<WorkspaceArtifact[]>([]);
  const [selectedWorkspaceProjectId, setSelectedWorkspaceProjectId] = useState<string | null>(null);
  const [selectedWorkspaceArtifactId, setSelectedWorkspaceArtifactId] = useState<string | null>(null);
  const [workspaceCaptureEnabled, setWorkspaceCaptureEnabled] = useState(false);
  const [enforceToolApprovals, setEnforceToolApprovals] = useState(false);
  const [approvedCapabilityScopes, setApprovedCapabilityScopes] = useState<ToolCapabilityScope[]>([
    'read_local_files',
    'write_local_files',
    'network_read',
  ]);
  const [isWorkspaceSaving, setIsWorkspaceSaving] = useState(false);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const selectedWorkspaceProject = useMemo(
    () => workspaceProjects.find((project) => project.id === selectedWorkspaceProjectId) || null,
    [selectedWorkspaceProjectId, workspaceProjects],
  );

  const selectedWorkspaceArtifact = useMemo(
    () => workspaceArtifacts.find((artifact) => artifact.id === selectedWorkspaceArtifactId) || null,
    [selectedWorkspaceArtifactId, workspaceArtifacts],
  );

  const lastAssistantText = useMemo(() => {
    for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
      const message = conversation.messages[index];
      if (message.role === 'assistant' && typeof message.content === 'string' && message.content.trim()) {
        return message.content;
      }
    }
    return '';
  }, [conversation.messages]);

  const loadWorkspaceProjects = useCallback(async () => {
    setIsWorkspaceLoading(true);
    try {
      const data = await fetchWorkspaceJson<WorkspaceProjectsResponse>('/api/workspace/projects');
      const projects = data.projects || [];
      setWorkspaceProjects(projects);
      setSelectedWorkspaceProjectId((current) => {
        if (current && projects.some((project) => project.id === current)) return current;
        return projects[0]?.id || null;
      });
    } catch (err) {
      toast({
        title: 'Workspace nicht geladen',
        description: err instanceof Error ? err.message : 'Projekte konnten nicht geladen werden.',
        variant: 'destructive',
      });
    } finally {
      setIsWorkspaceLoading(false);
    }
  }, [toast]);

  const loadWorkspaceArtifacts = useCallback(async (projectId: string) => {
    try {
      const data = await fetchWorkspaceJson<WorkspaceArtifactsResponse>(
        `/api/workspace/artifacts?projectId=${encodeURIComponent(projectId)}`,
      );
      const artifacts = data.artifacts || [];
      setWorkspaceArtifacts(artifacts);
      setSelectedWorkspaceArtifactId((current) => {
        if (current && artifacts.some((artifact) => artifact.id === current)) return current;
        return null;
      });
    } catch (err) {
      toast({
        title: 'Artefakte nicht geladen',
        description: err instanceof Error ? err.message : 'Artefakte konnten nicht geladen werden.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    void loadWorkspaceProjects();
  }, [loadWorkspaceProjects]);

  useEffect(() => {
    if (!selectedWorkspaceProjectId) {
      setWorkspaceArtifacts([]);
      setSelectedWorkspaceArtifactId(null);
      return;
    }
    void loadWorkspaceArtifacts(selectedWorkspaceProjectId);
  }, [loadWorkspaceArtifacts, selectedWorkspaceProjectId]);

  const createWorkspaceProjectFromConversation = useCallback(async (): Promise<WorkspaceProject | null> => {
    const fallbackName = selectedModel ? `Chat mit ${selectedModel}` : 'Chat Workspace';
    const name = conversation.title && conversation.title !== 'New Conversation'
      ? conversation.title
      : fallbackName;

    try {
      const data = await fetchWorkspaceJson<{ success: boolean; project: WorkspaceProject }>(
        '/api/workspace/projects',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: 'Aus dem Chat erstellt',
            tags: ['chat'],
          }),
        },
      );
      setWorkspaceProjects((current) => [data.project, ...current]);
      setSelectedWorkspaceProjectId(data.project.id);
      setWorkspaceCaptureEnabled(true);
      toast({ title: 'Workspace-Projekt erstellt', description: data.project.name });
      return data.project;
    } catch (err) {
      toast({
        title: 'Projekt konnte nicht erstellt werden',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
      return null;
    }
  }, [conversation.title, selectedModel, toast]);

  const createWorkspaceArtifactFromChat = useCallback(async (
    projectId: string,
    prompt: string,
    answer: string,
    sourceLabel = 'Chat-Agent-Antwort',
  ): Promise<WorkspaceArtifactWithContent | null> => {
    try {
      const data = await fetchWorkspaceJson<WorkspaceArtifactResponse>(
        '/api/workspace/artifacts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            type: 'research_brief',
            title: summarizeTextForTitle(prompt),
            description: `Aus ${sourceLabel} erzeugt`,
            content: buildCapturedArtifactContent(prompt, answer, selectedModel, sourceLabel),
            sourceRefs: [{
              kind: 'conversation',
              title: conversation.title || 'Chat',
              uri: `/chat?load=${conversation.id}`,
              capturedAt: new Date().toISOString(),
              reliability: 'high',
            }],
          }),
        },
      );

      if (data.artifact) {
        setWorkspaceArtifacts((current) => [data.artifact!, ...current]);
        setSelectedWorkspaceArtifactId(data.artifact.id);
        return data.artifact;
      }
      return null;
    } catch (err) {
      toast({
        title: 'Artefakt konnte nicht erstellt werden',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
      return null;
    }
  }, [conversation.id, conversation.title, selectedModel, toast]);

  const updateWorkspaceArtifactFromChat = useCallback(async (
    artifactId: string,
    prompt: string,
    answer: string,
    sourceLabel = 'Chat-Agent-Antwort',
  ): Promise<WorkspaceArtifactWithContent | null> => {
    try {
      const data = await fetchWorkspaceJson<WorkspaceArtifactResponse>(
        `/api/workspace/artifacts/${encodeURIComponent(artifactId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: buildCapturedArtifactContent(prompt, answer, selectedModel, sourceLabel),
            modelProvenance: selectedModel
              ? [{
                  provider: 'ollama',
                  model: selectedModel,
                  role: 'assistant',
                  createdAt: new Date().toISOString(),
                  note: `Captured from ${sourceLabel}`,
                }]
              : undefined,
          }),
        },
      );
      if (data.artifact) {
        setWorkspaceArtifacts((current) =>
          current.map((artifact) =>
            artifact.id === data.artifact?.id
              ? {
                  ...artifact,
                  updatedAt: data.artifact.updatedAt,
                  runIds: data.artifact.runIds,
                  savepointIds: data.artifact.savepointIds,
                  sourceRefs: data.artifact.sourceRefs,
                }
              : artifact,
          ),
        );
      }
      return data.artifact || null;
    } catch (err) {
      toast({
        title: 'Artefakt konnte nicht aktualisiert werden',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
      return null;
    }
  }, [selectedModel, toast]);

  const saveLastAssistantToWorkspace = useCallback(async () => {
    const projectId = selectedWorkspaceProjectId;
    if (!projectId || !lastAssistantText.trim()) return;

    setIsWorkspaceSaving(true);
    const prompt = conversation.messages
      .filter((message) => message.role === 'user' && typeof message.content === 'string')
      .at(-1)?.content;

    try {
      if (selectedWorkspaceArtifactId) {
        await updateWorkspaceArtifactFromChat(
          selectedWorkspaceArtifactId,
          typeof prompt === 'string' ? prompt : 'Chat Antwort',
          lastAssistantText,
        );
      } else {
        await createWorkspaceArtifactFromChat(
          projectId,
          typeof prompt === 'string' ? prompt : 'Chat Antwort',
          lastAssistantText,
        );
      }
      toast({ title: 'Antwort gespeichert', description: selectedWorkspaceProject?.name || 'Workspace' });
    } finally {
      setIsWorkspaceSaving(false);
    }
  }, [
    conversation.messages,
    createWorkspaceArtifactFromChat,
    lastAssistantText,
    selectedWorkspaceArtifactId,
    selectedWorkspaceProject?.name,
    selectedWorkspaceProjectId,
    toast,
    updateWorkspaceArtifactFromChat,
  ]);

  const toggleApprovalScope = useCallback((scope: ToolCapabilityScope) => {
    setApprovedCapabilityScopes((current) =>
      current.includes(scope)
        ? current.filter((entry) => entry !== scope)
        : [...current, scope],
    );
  }, []);

  const handleDocumentUploadInChat = useCallback(
    async (file: File) => {
      await uploadRagDocument(file);
      if (!ragEnabled) {
        setRagEnabled(true);
      }
    },
    [uploadRagDocument, ragEnabled, setRagEnabled],
  );

  // ── Sidebar resize handlers ───────────────────────────────────
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    updateSettings({ sidebarWidth });
  }, [sidebarWidth, updateSettings]);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
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

  // Listen for global Cmd+N shortcut
  useEffect(() => {
    const handler = () => handleNewConversation();
    window.addEventListener('locai:new-chat', handler);
    return () => window.removeEventListener('locai:new-chat', handler);
  }, [handleNewConversation]);

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
  ], [handleNewConversation, handleSaveConversation, isStreaming, stopStreaming]);

  useKeyboardShortcuts(shortcuts);

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
      // Build conversation history for agent context
      const history = conversation.messages.map(msg => ({
        role: msg.role as string,
        content: typeof msg.content === 'string' ? msg.content : '[media content]',
      }));
      history.push({ role: 'user', content });

      // Add user message to conversation
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content,
        timestamp: new Date(),
        modelName: selectedModel,
      };
      addMessage(userMessage);

      if (workflowMode) {
        let workspaceArtifactIdForRun = selectedWorkspaceArtifactId || undefined;
        const workspaceProjectIdForRun = selectedWorkspaceProjectId || undefined;

        if (workspaceCaptureEnabled && workspaceProjectIdForRun && !workspaceArtifactIdForRun) {
          const artifact = await createWorkspaceArtifactFromChat(
            workspaceProjectIdForRun,
            content,
            '_Workflow run pending..._',
            'Workflow-Agent-Antwort',
          );
          workspaceArtifactIdForRun = artifact?.id;
        }

        // Workflow Engine mode: use new endpoint
        resetWorkflow();
        const finalContent = await sendWorkflowMessage(content, {
          conversationHistory: history,
          enabledTools,
          model: selectedModel,
          host: settings?.ollamaHost,
          presetId: activePreset ?? undefined,
          conversationId: conversation.id,
          workspaceProjectId: workspaceProjectIdForRun,
          workspaceArtifactId: workspaceArtifactIdForRun,
          enforceToolApprovals,
          approvedCapabilityScopes,
        });

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

        if (finalContent && workspaceCaptureEnabled && workspaceProjectIdForRun) {
          if (workspaceArtifactIdForRun) {
            await updateWorkspaceArtifactFromChat(
              workspaceArtifactIdForRun,
              content,
              finalContent,
              'Workflow-Agent-Antwort',
            );
          } else {
            await createWorkspaceArtifactFromChat(
              workspaceProjectIdForRun,
              content,
              finalContent,
              'Workflow-Agent-Antwort',
            );
          }
        }
      } else {
        let workspaceArtifactIdForRun = selectedWorkspaceArtifactId || undefined;
        const workspaceProjectIdForRun = selectedWorkspaceProjectId || undefined;

        if (workspaceCaptureEnabled && workspaceProjectIdForRun && !workspaceArtifactIdForRun) {
          const artifact = await createWorkspaceArtifactFromChat(
            workspaceProjectIdForRun,
            content,
            '_Agent run pending..._',
          );
          workspaceArtifactIdForRun = artifact?.id;
        }

        // Classic agent mode: send through agent pipeline
        const finalContent = await sendAgentMessage(content, {
          conversationHistory: history,
          enabledTools,
          model: selectedModel,
          host: settings?.ollamaHost,
          presetId: activePreset ?? undefined,
          enablePlanning,
          workspaceProjectId: workspaceProjectIdForRun,
          workspaceArtifactId: workspaceArtifactIdForRun,
          enforceToolApprovals,
          approvedCapabilityScopes,
        });

        // Add the final bot message to conversation
        if (finalContent) {
          const botMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: finalContent,
            timestamp: new Date(),
            modelName: selectedModel,
            ...(memoryContext && memoryContext.length > 0 ? { memoryContext } : {}),
          };
          addMessage(botMessage);
        }

        if (finalContent && workspaceCaptureEnabled && workspaceProjectIdForRun) {
          if (workspaceArtifactIdForRun) {
            await updateWorkspaceArtifactFromChat(workspaceArtifactIdForRun, content, finalContent);
          } else {
            await createWorkspaceArtifactFromChat(workspaceProjectIdForRun, content, finalContent);
          }
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cancelWorkflow is stable (ref-based)
  }, [
    sendMessage,
    conversation,
    selectedModel,
    addMessage,
    setSelectedModel,
    visionModels,
    toast,
    isAgentMode,
    sendAgentMessage,
    enabledTools,
    ragEnabled,
    settings?.ollamaHost,
    activePreset,
    enablePlanning,
    workflowMode,
    sendWorkflowMessage,
    resetWorkflow,
    selectedWorkspaceArtifactId,
    selectedWorkspaceProjectId,
    workspaceCaptureEnabled,
    createWorkspaceArtifactFromChat,
    updateWorkspaceArtifactFromChat,
    enforceToolApprovals,
    approvedCapabilityScopes,
  ]);

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

  // ── Open file in agent from file browser ─────────────────────

  useEffect(() => {
    const shouldOpenInAgent = searchParams.get('openFileInAgent');
    if (!shouldOpenInAgent) return;

    const storedData = sessionStorage.getItem(OPEN_FILE_IN_AGENT_SESSION_KEY);
    if (storedData) {
      try {
        const payload = JSON.parse(storedData) as OpenFileInAgentPayload;
        setPendingOpenFilePrompt(buildOpenFileAgentPrompt(payload));
        toast({
          title: 'Datei in Agent geöffnet',
          description: `"${payload.filename}" wurde als Entwurf in den Chat übernommen.`,
        });
      } catch (err) {
        console.error('Failed to parse open file in agent payload:', err);
        toast({
          title: 'Open in Agent fehlgeschlagen',
          description: 'Dateikontext konnte nicht gelesen werden.',
          variant: 'destructive',
        });
      } finally {
        sessionStorage.removeItem(OPEN_FILE_IN_AGENT_SESSION_KEY);
      }
    } else {
      toast({
        title: 'Open in Agent fehlgeschlagen',
        description: 'Kein Dateikontext gefunden.',
        variant: 'destructive',
      });
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('openFileInAgent');
    const qs = nextParams.toString();
    router.replace(qs ? `/chat?${qs}` : '/chat', { scroll: false });
  }, [router, searchParams, toast]);

  useEffect(() => {
    if (!pendingOpenFilePrompt) return;

    setIsAgentMode(true);

    if (conversation.messages.length === 0) {
      if (!selectedModel) return;
      handleStartConversation();
      return;
    }

    setPrefillMessage(pendingOpenFilePrompt);
    setPrefillVersion((prev) => prev + 1);
    setPendingOpenFilePrompt(null);
    window.setTimeout(() => chatInputRef.current?.focus(), 60);
  }, [
    conversation.messages.length,
    handleStartConversation,
    pendingOpenFilePrompt,
    selectedModel,
    setIsAgentMode,
  ]);

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
    <div className={`flex h-full overflow-hidden ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {/* ── Conversation Sidebar ─────────────────────────────────── */}
      {showSidebar && (
        <div 
          ref={sidebarRef}
          style={{ width: `${sidebarWidth}px` }}
          className={`relative border-r border-border/60 bg-sidebar/50 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-72 max-md:pt-14 max-md:shadow-xl ${isResizing ? 'select-none cursor-col-resize' : ''}`}
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
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors group flex items-center justify-center ${isResizing ? 'bg-primary/50' : 'bg-transparent'}`}
            onMouseDown={startResizing}
          >
            <div className="absolute right-0 w-4 h-full" />
            <GripVertical className="h-5 w-5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
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

              {/* Workflow Resume Dialog */}
              {pendingResumeState && (
                <div className="mx-3 lg:mx-5 mb-3 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10">
                  <p className="text-sm font-medium mb-1">Unterbrochener Workflow gefunden</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Ein Workflow mit {pendingResumeState.steps.length} Schritt(en) wurde unterbrochen.
                    Ziel: {pendingResumeState.plan?.goal ?? pendingResumeState.userMessage}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={handleResumeWorkflow}>
                      Workflow fortsetzen
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDiscardWorkflow}>
                      Verwerfen
                    </Button>
                  </div>
                </div>
              )}

              {/* Agent message (classic mode: tool calls + streaming) */}
              {isAgentMode && !workflowMode && (isAgentLoading || agentTurns.length > 0) && (
                <div className="px-3 lg:px-5">
                  <AgentMessage
                    turns={agentTurns}
                    content={agentStreamingContent}
                    isLoading={isAgentLoading}
                    isExecutingTool={isExecutingTool}
                    currentTurnIndex={currentTurnIndex}
                    totalTurnsEstimate={totalTurnsEstimate}
                    modelName={selectedModel}
                    error={agentError}
                    plan={agentPlan}
                  />
                </div>
              )}

              {/* Workflow Engine mode: WorkflowProgress visualization */}
              {isAgentMode && workflowMode && (isWorkflowRunning || workflowState.steps.length > 0 || workflowState.status !== 'idle') && (
                <div className="px-3 lg:px-5 mb-2">
                  <WorkflowProgress
                    workflowState={workflowState}
                    isRunning={isWorkflowRunning}
                    content={workflowState.streamingAnswer}
                    modelName={selectedModel}
                    enableReflection={enableReflection}
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
              {(isStreaming || isAgentLoading || isWorkflowRunning) && (
                <div className="px-4 py-2 border-t border-border/40 flex justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={
                      isWorkflowRunning
                        ? cancelWorkflow
                        : isAgentLoading
                        ? cancelAgentRun
                        : stopStreaming
                    }
                    className="text-destructive hover:text-destructive"
                  >
                    {isWorkflowRunning ? 'Workflow stoppen' : isAgentLoading ? 'Agent stoppen' : 'Stop Generating'}
                  </Button>
                </div>
              )}

              {/* Workspace bridge */}
              {isAgentMode && (
                <div className="border-t border-border/40 px-3 py-2 lg:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-[220px] items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <Select
                        value={selectedWorkspaceProjectId || NO_WORKSPACE_PROJECT}
                        onValueChange={(value) => {
                          const nextProjectId = value === NO_WORKSPACE_PROJECT ? null : value;
                          setSelectedWorkspaceProjectId(nextProjectId);
                          setSelectedWorkspaceArtifactId(null);
                        }}
                        disabled={isWorkspaceLoading}
                      >
                        <SelectTrigger size="sm" className="w-[220px]">
                          <SelectValue placeholder="Workspace" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_WORKSPACE_PROJECT}>Kein Projekt</SelectItem>
                          {workspaceProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Select
                      value={selectedWorkspaceArtifactId || NO_WORKSPACE_ARTIFACT}
                      onValueChange={(value) => {
                        setSelectedWorkspaceArtifactId(value === NO_WORKSPACE_ARTIFACT ? null : value);
                      }}
                      disabled={!selectedWorkspaceProjectId || workspaceArtifacts.length === 0}
                    >
                      <SelectTrigger size="sm" className="w-[220px]">
                        <SelectValue placeholder="Artefakt" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_WORKSPACE_ARTIFACT}>Kein Artefakt</SelectItem>
                        {workspaceArtifacts.map((artifact) => (
                          <SelectItem key={artifact.id} value={artifact.id}>
                            {artifact.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void createWorkspaceProjectFromConversation()}
                      disabled={isWorkspaceSaving || isWorkspaceLoading}
                      title="Workspace-Projekt aus dieser Konversation erstellen"
                    >
                      <Briefcase className="h-4 w-4" />
                      Neu
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={workspaceCaptureEnabled ? 'default' : 'outline'}
                      onClick={() => setWorkspaceCaptureEnabled((current) => !current)}
                      disabled={!selectedWorkspaceProjectId}
                      title="Agent-Antwort als Workspace-Artefakt erfassen"
                    >
                      <Check className="h-4 w-4" />
                      Capture
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void saveLastAssistantToWorkspace()}
                      disabled={!selectedWorkspaceProjectId || !lastAssistantText.trim() || isWorkspaceSaving}
                      title="Letzte Antwort im Workspace speichern"
                    >
                      {isWorkspaceSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Speichern
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={enforceToolApprovals ? 'default' : 'outline'}
                      onClick={() => setEnforceToolApprovals((current) => !current)}
                      title="Tool-Approvals erzwingen"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {enforceToolApprovals ? 'Enforce' : 'Audit'}
                    </Button>

                    {enforceToolApprovals && (
                      <div className="flex flex-wrap items-center gap-1">
                        {APPROVAL_SCOPE_OPTIONS.map((option) => {
                          const active = approvedCapabilityScopes.includes(option.scope);
                          return (
                            <Button
                              key={option.scope}
                              type="button"
                              size="sm"
                              variant={active ? 'secondary' : 'outline'}
                              onClick={() => toggleApprovalScope(option.scope)}
                              className="h-8 px-2"
                            >
                              {option.label}
                            </Button>
                          );
                        })}
                      </div>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push('/workspace')}
                      title="Workspace öffnen"
                    >
                      Workspace
                    </Button>

                    {selectedWorkspaceArtifact && (
                      <span className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {selectedWorkspaceArtifact.title}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Chat Input */}
              <div className="px-3 lg:px-5 pb-6">
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
                  disabled={isChatLoading || isAgentLoading || isWorkflowRunning}
                  inputRef={chatInputRef}
                  searxngUrl={settings?.searxngUrl}
                  searxngEnabled={settings?.searxngEnabled}
                  ollamaHost={settings?.ollamaHost}
                  selectedModel={selectedModel}
                  agentMode={isAgentMode}
                  onToggleAgentMode={toggleAgentMode}
                  enabledTools={enabledTools}
                  onToggleTool={toggleTool}
                  activePreset={activePreset}
                  onSelectPreset={selectPreset}
                  enablePlanning={enablePlanning}
                  onTogglePlanning={togglePlanning}
                  prefillMessage={prefillMessage}
                  prefillVersion={prefillVersion}
                  workflowMode={workflowMode}
                  onToggleWorkflowMode={toggleWorkflowMode}
                  enableReflection={enableReflection}
                  onToggleReflection={toggleReflection}
                  onDocumentUpload={handleDocumentUploadInChat}
                />
              </div>
            </>
          )}
        </main>
      </div>
      
      {/* ── Model Pull Dialog ────────────────────────────────────── */}
      {showModelPull ? (
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
      ) : null}

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
