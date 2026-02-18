import React, { useEffect, useState, useRef } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ChatInputProps } from "../../types/chat";
import { motion } from "framer-motion";
import { Send, Image, X } from "lucide-react";
import { WebSearchButton } from "./WebSearchButton";
import { AgentModeToggle } from "./AgentModeToggle";
import { cn } from "../../lib/utils";
import type { AgentPreset } from "@/lib/agents/presets";

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
}: ChatInputExtendedProps) {
  const [message, setMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localInputRef = useRef<HTMLTextAreaElement>(null);
  
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

  return (
    <motion.div
      className={cn(
        "sticky bottom-0 w-full p-4 bg-background border-t transition-colors duration-300",
        agentMode && "border-t-primary/40"
      )}
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
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

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={agentMode ? "Agent Modus — KI kann Werkzeuge nutzen..." : "Enter message... (Ctrl+Enter or Enter to send)"}
          disabled={disabled}
          className={cn(
            "flex-grow min-h-[44px] max-h-[200px] resize-none transition-colors duration-300",
            agentMode && "border-primary/40 focus-visible:ring-primary/30"
          )}
          rows={1}
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
          disabled={disabled}
          onClick={triggerFileInput}
          title="Upload image"
        >
          <Image className="h-4 w-4" />
        </Button>
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
          disabled={disabled || (!message.trim() && selectedImages.length === 0)}
        >
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
      </form>
    </motion.div>
  );
} 
