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
          <div className="flex justify-center my-4">
            <div className="animate-pulse flex space-x-2">
              <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
              <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
              <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </motion.div>
  );
} 