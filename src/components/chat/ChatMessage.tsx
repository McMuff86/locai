import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "../ui/card";
import { ChatMessageProps, MessageContent, MessageImageContent } from "../../types/chat";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";
import { ThinkingProcess } from "./ThinkingProcess";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SourceCitation } from "./SourceCitation";
import { useSettings } from "../../hooks/useSettings";
import { ChatAvatar } from "./ChatAvatar";

// Regular expression to extract thinking process from messages
const THINK_REGEX = /<think>([\s\S]*?)<\/think>/;

// Render message content (text or images or both)
const MessageContentRenderer = ({ content, isUser }: { content: MessageContent; isUser: boolean }) => {
  const textClass = "whitespace-pre-wrap" ; // font-size comes from CSS var
  const textStyle = { fontSize: 'var(--font-size-chat)' };
  
  // Sicherheitscheck für ungültige Inhalte
  if (content === null || content === undefined) {
    return <p className={cn(textClass, "text-muted-foreground")} style={textStyle}>Keine Inhalte</p>;
  }
  
  // If content is a string
  if (typeof content === 'string') {
    // For user messages, use simple text rendering
    if (isUser) {
      return <p className={textClass} style={textStyle}>{content}</p>;
    }
    // For assistant messages, use markdown renderer
    return <MarkdownRenderer content={content} className="" style={textStyle} />;
  }
  
  // If content is an image
  if (typeof content === 'object' && 'type' in content && content.type === 'image') {
    const imageContent = content as MessageImageContent;
    return (
      <div className="my-2">
        <img 
          src={imageContent.url} 
          alt={imageContent.alt || "Image"} 
          className="max-w-full rounded-md"
          style={{ maxHeight: '300px' }}
        />
      </div>
    );
  }
  
  // If content is an array
  if (Array.isArray(content)) {
    return (
      <>
        {content.map((item, index) => {
          if (typeof item === 'string') {
            if (isUser) {
              return <p key={index} className={cn(textClass, "mb-2")} style={textStyle}>{item}</p>;
            }
            return <MarkdownRenderer key={index} content={item} className="mb-2" style={textStyle} />;
          }
          
          if (typeof item === 'object' && 'type' in item && item.type === 'image') {
            const imageItem = item as MessageImageContent;
            return (
              <div key={index} className="my-2">
                <img 
                  src={imageItem.url} 
                  alt={imageItem.alt || "Image"} 
                  className="max-w-full rounded-md"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            );
          }
          
          return null;
        })}
      </>
    );
  }
  
  // Fallback for unexpected content
  console.warn("Unbekannter Inhaltstyp:", content);
  return <p className={cn(textClass, "text-muted-foreground")} style={textStyle}>Nicht unterstützter Inhalt</p>;
};

// Format timestamp for display
function formatTimestamp(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessage({ message, isLastMessage = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const { settings } = useSettings();
  const chatLayout = settings?.chatLayout || 'linear';
  const [thinkingProcess, setThinkingProcess] = useState<string | null>(null);
  const [finalContent, setFinalContent] = useState<MessageContent>(message.content);
  const [showResponse, setShowResponse] = useState(false);
  
  // Use a ref to track if animation has already played
  const animationCompletedRef = useRef(false);
  // Use a ref to store the message ID to detect when it actually changes
  const messageIdRef = useRef(message.id);
  
  // Process message content to extract thinking process if present
  useEffect(() => {
    // Check if this is a new message
    const isNewMessage = messageIdRef.current !== message.id;
    
    // Update the ref to current message ID
    messageIdRef.current = message.id;
    
    // Reset animation state for new messages
    if (isNewMessage) {
      animationCompletedRef.current = false;
    }
    
    if (isUser) {
      // Don't process user messages
      setFinalContent(message.content);
      setThinkingProcess(null);
      setShowResponse(true); // Always show user messages immediately
      return;
    }
    
    // For loaded messages, skip thinking process
    if (message.isLoaded) {
      setFinalContent(message.content);
      // Only process as string if the content is actually a string
      if (typeof message.content === 'string' && message.content.includes("<think>")) {
        const cleanedContent = message.content.replace(THINK_REGEX, '').trim();
        setFinalContent(cleanedContent);
      }
      setThinkingProcess(null);
      setShowResponse(true); // Show loaded messages immediately
      return;
    }
    
    // Only process thinking tags for string content
    if (typeof message.content === 'string') {
      const match = message.content.match(THINK_REGEX);
      if (match && match[1]) {
        // Found thinking process
        setThinkingProcess(match[1].trim());
        
        // Remove thinking process from displayed message
        const cleanedContent = message.content.replace(THINK_REGEX, '').trim();
        setFinalContent(cleanedContent);
        
        // If this animation was already completed before, show the response immediately
        if (animationCompletedRef.current) {
          setShowResponse(true);
        } else {
          setShowResponse(false); // Hide response until thinking animation completes
        }
        return;
      }
    }
    
    // No thinking process found or non-string content
    setFinalContent(message.content);
    setThinkingProcess(null);
    setShowResponse(true); // Show response immediately
  }, [message.content, message.id, isUser, message.isLoaded]);
  
  // Callback for when thinking animation completes
  const handleThinkingComplete = () => {
    animationCompletedRef.current = true; // Mark this animation as completed
    setShowResponse(true);
  };

  // Derive display name
  const displayName = isUser ? 'Du' : (message.modelName || 'LocAI');
  const timestamp = formatTimestamp(message.timestamp);
  
  return (
    <>
      {/* Render thinking process if present */}
      {!isUser && thinkingProcess && (
        <ThinkingProcess 
          content={thinkingProcess} 
          onAnimationComplete={handleThinkingComplete}
          isAnimated={!animationCompletedRef.current} // Only animate if not completed yet
        />
      )}
      
      {/* Render actual message */}
      {showResponse && chatLayout === 'linear' ? (
        /* ─── Linear Layout (OpenClaw Style) ─── */
        <motion.div
          className={cn(
            "flex flex-col w-full mb-3",
            isUser && "pl-5 border-l-2 border-primary/25"
          )}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] }}
        >
          {/* Header row: Avatar + Name + Timestamp */}
          <div className="flex items-center gap-2 mb-1.5">
            <ChatAvatar type={isUser ? 'user' : 'ai'} size={32} />
            <span className="text-[13px] font-semibold text-foreground/90 tracking-tight">{displayName}</span>
            <span className="text-[11px] text-muted-foreground/60 font-mono ml-auto">{timestamp}</span>
          </div>

          {/* Message content card */}
          <div className={cn(isUser ? "pl-[40px]" : "pl-[44px]")}>
            <Card className={cn(
              "max-w-[95%] border",
              isUser
                ? [
                    "border-primary/15",
                    "bg-gradient-to-br from-accent/40 via-card/60 to-card/50",
                    "shadow-sm shadow-black/20",
                  ]
                : [
                    "border-border/50 bg-card/80",
                    "shadow-sm shadow-black/20",
                  ]
            )}>
              <CardContent className="px-4 py-3">
                <MessageContentRenderer content={finalContent} isUser={isUser} />
              </CardContent>
            </Card>
            {/* RAG Source Citations */}
            {!isUser && message.ragSources && message.ragSources.length > 0 && (
              <SourceCitation sources={message.ragSources} className="max-w-[95%] mt-1.5" />
            )}
          </div>
        </motion.div>
      ) : showResponse ? (
        /* ─── Bubbles Layout (Classic) ─── */
        <motion.div
          className={cn(
            "flex flex-col w-full mb-3",
            isUser ? "items-end" : "items-start"
          )}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] }}
        >
          {/* Name + timestamp */}
          <div className={cn(
            "flex items-center gap-1.5 mb-1 px-1",
            isUser ? "flex-row-reverse" : "flex-row"
          )}>
            <ChatAvatar type={isUser ? 'user' : 'ai'} size={28} />
            <span className="text-[12px] font-semibold text-foreground/80 tracking-tight">{displayName}</span>
            <span className="text-[11px] text-muted-foreground/50 font-mono">{timestamp}</span>
          </div>

          <div className={cn(
            "flex",
            isUser ? "justify-end" : "justify-start"
          )}>
            <Card className={cn(
              "max-w-[82%] border",
              isUser
                ? [
                    "rounded-2xl rounded-tr-sm",
                    "border-primary/15",
                    "bg-gradient-to-br from-accent/40 via-card/60 to-card/50",
                    "shadow-sm shadow-black/20",
                  ]
                : [
                    "rounded-xl rounded-tl-sm",
                    "border-border/50 bg-card/80",
                    "shadow-sm shadow-black/20",
                  ]
            )}>
              <CardContent className="px-4 py-3">
                <MessageContentRenderer content={finalContent} isUser={isUser} />
              </CardContent>
            </Card>
          </div>
          {/* RAG Source Citations */}
          {!isUser && message.ragSources && message.ragSources.length > 0 && (
            <div className="mt-1.5 ml-2">
              <SourceCitation sources={message.ragSources} className="max-w-[82%]" />
            </div>
          )}
        </motion.div>
      ) : null}
    </>
  );
} 