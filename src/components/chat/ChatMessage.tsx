import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Card, CardContent } from "../ui/card";
import { ChatMessageProps } from "../../types/chat";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";

export function ChatMessage({ message, isLastMessage = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
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
        <Avatar className="h-8 w-8 mr-2">
          <AvatarImage src="/bot-avatar.png" alt="Bot" />
          <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
        </Avatar>
      )}
      
      <Card className={cn(
        "max-w-[80%]",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-secondary text-secondary-foreground"
      )}>
        <CardContent className="p-3">
          <p className="text-sm">{message.content}</p>
        </CardContent>
      </Card>
      
      {isUser && (
        <Avatar className="h-8 w-8 ml-2">
          <AvatarImage src="/user-avatar.png" alt="User" />
          <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
} 