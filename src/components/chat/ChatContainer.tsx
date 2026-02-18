import React, { useRef, useEffect } from "react";
import { ChatContainerProps } from "../../types/chat";
import { ChatMessage } from "./ChatMessage";
import { motion } from "framer-motion";

export function ChatContainer({ conversation, isLoading = false }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Automatisches Scrollen zum Ende der Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages]);

  return (
    <motion.div 
      className="flex-1 overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-full px-4 lg:px-8">
        {conversation.messages.map((message, index) => (
          <ChatMessage 
            key={message.id} 
            message={message} 
            isLastMessage={index === conversation.messages.length - 1}
          />
        ))}
        
        {isLoading && (
          <div className="flex flex-col w-full mb-3 pl-5">
            {/* Skeleton header */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-8 w-8 rounded-full animate-shimmer" />
              <div className="h-3 w-20 rounded-md animate-shimmer" />
            </div>
            {/* Skeleton lines */}
            <div className="pl-[44px] space-y-2">
              <div className="h-3.5 w-[70%] rounded-md animate-shimmer" />
              <div className="h-3.5 w-[55%] rounded-md animate-shimmer" />
              <div className="h-3.5 w-[40%] rounded-md animate-shimmer" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </motion.div>
  );
} 