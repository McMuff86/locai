import React, { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Card, CardContent } from "../ui/card";
import { ChatMessageProps, MessageContent, MessageImageContent } from "../../types/chat";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";
import { ThinkingProcess } from "./ThinkingProcess";
import { User, UserCircle } from "lucide-react";

// Regular expression to extract thinking process from messages
const THINK_REGEX = /<think>([\s\S]*?)<\/think>/;

// Render message content (text or images or both)
const MessageContentRenderer = ({ content }: { content: MessageContent }) => {
  // Sicherheitscheck für ungültige Inhalte
  if (content === null || content === undefined) {
    return <p className="text-sm whitespace-pre-wrap text-muted-foreground">Keine Inhalte</p>;
  }
  
  // If content is a string, render it directly
  if (typeof content === 'string') {
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
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
            return <p key={index} className="text-sm whitespace-pre-wrap mb-2">{item}</p>;
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
  return <p className="text-sm whitespace-pre-wrap text-muted-foreground">Nicht unterstützter Inhalt</p>;
};

export function ChatMessage({ message, isLastMessage = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
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
      {showResponse && (
        <motion.div
          className={cn(
            "flex w-full mb-4",
            isUser ? "justify-end" : "justify-start"
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {!isUser && (
            <div className="h-40 w-40 mr-4 self-start flex-shrink-0">
              <img 
                src="/LocAI_logo_v0.2.svg" 
                alt="LocAI" 
                className="h-full w-full object-contain"
              />
            </div>
          )}
          
          <Card className={cn(
            "max-w-[80%]",
            isUser 
              ? "bg-muted/50 text-foreground" 
              : "bg-muted/50 text-foreground"
          )}>
            <CardContent className={cn(
              "p-3",
              "font-mono"
            )}>
              <MessageContentRenderer content={finalContent} />
            </CardContent>
          </Card>
          
          {isUser && (
            <Avatar className="h-8 w-8 ml-2 self-start mt-1">
              <div className="flex items-center justify-center w-full h-full bg-background text-primary">
                <User className="h-6 w-6" />
              </div>
              <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
            </Avatar>
          )}
        </motion.div>
      )}
    </>
  );
} 