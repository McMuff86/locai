import React, { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Card, CardContent } from "../ui/card";
import { ChatMessageProps } from "../../types/chat";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";
import { ThinkingProcess } from "./ThinkingProcess";

// Regular expression to extract thinking process from messages
const THINK_REGEX = /<think>([\s\S]*?)<\/think>/;

export function ChatMessage({ message, isLastMessage = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [thinkingProcess, setThinkingProcess] = useState<string | null>(null);
  const [finalContent, setFinalContent] = useState(message.content);
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
      // Strip out thinking process tag if present
      if (message.content.includes("<think>")) {
        const cleanedContent = message.content.replace(THINK_REGEX, '').trim();
        setFinalContent(cleanedContent);
      }
      setThinkingProcess(null);
      setShowResponse(true); // Show loaded messages immediately
      return;
    }
    
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
    } else {
      // No thinking process found
      setFinalContent(message.content);
      setThinkingProcess(null);
      setShowResponse(true); // Show response immediately
    }
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
            <Avatar className="h-8 w-8 mr-2 self-start mt-1">
              <AvatarImage src="/bot-avatar.png" alt="Bot" />
              <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
            </Avatar>
          )}
          
          <Card className={cn(
            "max-w-[80%]",
            isUser 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted/50 text-foreground"
          )}>
            <CardContent className="p-3">
              <p className={cn(
                "text-sm whitespace-pre-wrap",
                !isUser && "font-mono"
              )}>
                {finalContent}
              </p>
            </CardContent>
          </Card>
          
          {isUser && (
            <Avatar className="h-8 w-8 ml-2 self-start mt-1">
              <AvatarImage src="/user-avatar.png" alt="User" />
              <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
            </Avatar>
          )}
        </motion.div>
      )}
    </>
  );
} 