import React, { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ChatInputProps } from "../../types/chat";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Image, X, FileText, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { WebSearchButton } from "./WebSearchButton";
import { AgentModeToggle } from "./AgentModeToggle";
import { cn } from "../../lib/utils";
import type { AgentPreset } from "@/lib/agents/presets";
import type { FileUploadProgress } from "@/components/documents/DocumentUpload";

interface ChatInputExtendedProps extends ChatInputProps {
  agentMode?: boolean;
  onToggleAgentMode?: () => void;
  enabledTools?: string[];
  onToggleTool?: (toolName: string) => void;
  activePreset?: string | null;
  onSelectPreset?: (preset: AgentPreset | null) => void;
  enablePlanning?: boolean;
  onTogglePlanning?: () => void;
  prefillMessage?: string;
  prefillVersion?: number;
  /** Workflow Engine mode */
  workflowMode?: boolean;
  onToggleWorkflowMode?: () => void;
  /** Reflection toggle */
  enableReflection?: boolean;
  onToggleReflection?: () => void;
  /** Document upload handler */
  onDocumentUpload?: (file: File) => Promise<void>;
}

export function ChatInput({ 
  onSend, 
  disabled = false, 
  inputRef,
  searxngUrl,
  searxngEnabled = false,
  ollamaHost = 'http://localhost:11434',
  selectedModel = 'llama3',
  onWebSearchResults,
  agentMode = false,
  onToggleAgentMode,
  enabledTools = [],
  onToggleTool,
  activePreset,
  onSelectPreset,
  enablePlanning = false,
  onTogglePlanning,
  prefillMessage,
  prefillVersion = 0,
  workflowMode = false,
  onToggleWorkflowMode,
  enableReflection = true,
  onToggleReflection,
  onDocumentUpload,
}: ChatInputExtendedProps) {
  const [message, setMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [documentQueue, setDocumentQueue] = useState<FileUploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const localInputRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);
  
  // Use provided ref or local ref
  const textareaRef = inputRef || localInputRef;

  useEffect(() => {
    if (!prefillMessage || !prefillMessage.trim()) return;

    setMessage(prefillMessage);
    window.requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      element.focus();
      const end = prefillMessage.length;
      element.setSelectionRange(end, end);
    });
  }, [prefillMessage, prefillVersion, textareaRef]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((message.trim() || selectedImages.length > 0) && !disabled) {
      onSend(message, selectedImages);
      setMessage("");
      setSelectedImages([]);
      setImagePreviews([]);
    }
  };

  // Handle keyboard shortcuts in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }
    
    // Enter without shift sends (if single line)
    if (e.key === 'Enter' && !e.shiftKey && !message.includes('\n')) {
      e.preventDefault();
      handleSubmit();
      return;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedImages(prev => [...prev, ...newFiles]);
      
      // Create image previews
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImagePreviews(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
      
      // Clear the input value so the same file can be selected again
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerDocumentInput = () => {
    documentInputRef.current?.click();
  };

  // Document Upload Handlers
  const handleDocumentFile = useCallback(async (file: File) => {
    if (!onDocumentUpload) return;

    const newProgress: FileUploadProgress = {
      file,
      progress: 0,
      status: 'pending',
    };

    setDocumentQueue(prev => [...prev, newProgress]);

    try {
      setDocumentQueue(prev => 
        prev.map(item => 
          item.file === file 
            ? { ...item, status: 'uploading' as const, progress: 50 }
            : item
        )
      );

      await onDocumentUpload(file);

      setDocumentQueue(prev => 
        prev.map(item => 
          item.file === file 
            ? { ...item, status: 'success' as const, progress: 100 }
            : item
        )
      );

      // Add context note to the current message
      setMessage(prev => {
        const contextNote = `[📄 Dokument "${file.name}" wurde hochgeladen und steht als Kontext zur Verfügung]`;
        return prev ? `${prev}\n\n${contextNote}` : contextNote;
      });
    } catch (error) {
      setDocumentQueue(prev => 
        prev.map(item => 
          item.file === file 
            ? { 
                ...item, 
                status: 'error' as const, 
                progress: 0,
                error: error instanceof Error ? error.message : 'Upload fehlgeschlagen'
              }
            : item
        )
      );
    }

    // Clear queue after 3 seconds
    setTimeout(() => {
      setDocumentQueue(prev => prev.filter(item => item.file !== file));
    }, 3000);
  }, [onDocumentUpload]);

  // Document Drag & Drop Handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    
    // Check if any dragged items are files (not just images)
    const hasFiles = Array.from(e.dataTransfer.items).some(item => 
      item.kind === 'file' && !item.type.startsWith('image/')
    );
    
    if (hasFiles) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    const documentFiles = files.filter(file => 
      !file.type.startsWith('image/') && 
      (file.type.includes('pdf') || 
       file.type.includes('text') || 
       file.name.match(/\.(md|txt|pdf|ts|tsx|js|py|css|html|json)$/i))
    );
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    // Handle document files
    for (const file of documentFiles) {
      await handleDocumentFile(file);
    }

    // Handle image files (existing logic)
    if (imageFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...imageFiles]);
      
      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImagePreviews(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  }, [handleDocumentFile]);

  const handleDocumentInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        for (const file of Array.from(files)) {
          await handleDocumentFile(file);
        }
      }
      e.target.value = '';
    },
    [handleDocumentFile],
  );

  return (
    <motion.div
      className={cn(
        "sticky bottom-0 w-full p-5 bg-background border-t transition-colors duration-300 relative",
        agentMode && "border-t-primary/40"
      )}
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-50 flex items-center justify-center border-2 border-dashed border-primary/60 rounded-lg"
          >
            <div className="flex flex-col items-center gap-3 text-primary">
              <FileText className="h-12 w-12" />
              <div className="text-center">
                <p className="text-lg font-semibold">Dokument hier ablegen</p>
                <p className="text-sm opacity-80">PDF, Markdown, Text oder Code-Dateien</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Document Upload Progress */}
      <AnimatePresence>
        {documentQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 space-y-2 overflow-hidden"
          >
            {documentQueue.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-2 rounded-lg border border-border/30 bg-muted/5"
              >
                <div className="flex-shrink-0">
                  {item.status === 'success' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {item.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  )}
                  {item.status === 'pending' && (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.file.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(item.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                  
                  {item.error && (
                    <div className="text-xs text-red-500 mt-1">
                      {item.error}
                    </div>
                  )}
                </div>

                {item.status === 'error' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDocumentQueue(prev => prev.filter((_, i) => i !== index));
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image previews */}
      {imagePreviews.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative inline-block">
              <img 
                src={preview} 
                alt={`Preview ${index}`} 
                className="h-20 w-20 object-cover rounded border" 
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <Textarea
          ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={agentMode ? "Agent Modus — KI kann Werkzeuge nutzen..." : "Nachricht eingeben... (Ctrl+Enter oder Enter zum Senden)"}
          disabled={disabled}
          className={cn(
            "flex-grow min-h-[120px] max-h-[300px] resize-none transition-colors duration-300 text-base",
            agentMode && "border-primary/40 focus-visible:ring-primary/30"
          )}
          rows={4}
          data-chat-input
        />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
          multiple
        />
        <WebSearchButton
          searxngUrl={searxngUrl}
          ollamaHost={ollamaHost}
          model={selectedModel}
          enabled={searxngEnabled}
          onInsertResults={(results, query) => {
            if (onWebSearchResults) {
              onWebSearchResults(results, query);
            } else {
              // Fallback: Insert directly into message
              setMessage(prev => prev ? `${prev}\n\n${results}` : results);
            }
          }}
        />
        <Button 
          type="button" 
          variant="outline"
          size="lg"
          disabled={disabled}
          onClick={triggerFileInput}
          title="Upload image"
          className="h-12 w-12"
        >
          <Image className="h-5 w-5" />
        </Button>
        {onDocumentUpload && (
          <Button 
            type="button" 
            variant="outline"
            size="lg"
            disabled={disabled}
            onClick={triggerDocumentInput}
            title="Upload document"
            className="h-12 w-12"
          >
            <FileText className="h-5 w-5" />
          </Button>
        )}
        {onToggleAgentMode && onToggleTool && (
          <AgentModeToggle
            isActive={agentMode}
            onToggle={onToggleAgentMode}
            enabledTools={enabledTools}
            onToggleTool={onToggleTool}
            disabled={disabled}
            modelName={selectedModel}
            activePreset={activePreset}
            onSelectPreset={onSelectPreset}
            enablePlanning={enablePlanning}
            onTogglePlanning={onTogglePlanning}
            workflowMode={workflowMode}
            onToggleWorkflowMode={onToggleWorkflowMode}
            enableReflection={enableReflection}
            onToggleReflection={onToggleReflection}
          />
        )}
        <Button 
          type="submit" 
          size="lg"
          disabled={disabled || (!message.trim() && selectedImages.length === 0)}
          className="h-12 px-6 text-base font-semibold"
        >
          <Send className="h-5 w-5 mr-2" />
          Senden
        </Button>
      </form>
      
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={documentInputRef}
        onChange={handleDocumentInputChange}
        accept=".pdf,.txt,.md,.ts,.tsx,.js,.py,.css,.html,.json"
        className="hidden"
        multiple
      />
    </motion.div>
  );
} 
