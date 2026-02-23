import React, { useRef, useEffect, useState } from "react";
import { ChatContainerProps } from "../../types/chat";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { ScrollToBottom } from "./ScrollToBottom";
import { motion, AnimatePresence } from "framer-motion";

export function ChatContainer({ conversation, isLoading = false }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [previousMessageCount, setPreviousMessageCount] = useState(conversation.messages.length);

  // Show typing indicator when loading and then fade out when messages appear
  useEffect(() => {
    if (isLoading) {
      setShowTyping(true);
    } else {
      // Small delay to show typing indicator before first token
      const timer = setTimeout(() => {
        setShowTyping(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Track new messages for badge
  useEffect(() => {
    const currentCount = conversation.messages.length;
    if (currentCount > previousMessageCount) {
      const newMessages = currentCount - previousMessageCount;
      if (!isScrolledToBottom()) {
        setNewMessageCount(prev => prev + newMessages);
      }
    }
    setPreviousMessageCount(currentCount);
  }, [conversation.messages.length, previousMessageCount]);

  // Check if user has scrolled up
  const isScrolledToBottom = () => {
    if (!containerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold
  };

  // Handle scroll events to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrolledToBottom = isScrolledToBottom();
      setShowScrollToBottom(!scrolledToBottom && conversation.messages.length > 0);
      
      if (scrolledToBottom) {
        setNewMessageCount(0);
      }
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => container.removeEventListener('scroll', handleScroll);
  }, [conversation.messages.length]);

  // Auto scroll to bottom when new messages arrive (if already at bottom)
  useEffect(() => {
    if (isScrolledToBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setNewMessageCount(0);
    }
  }, [conversation.messages]);

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessageCount(0);
  };

  return (
    <>
      <motion.div 
        ref={containerRef}
        className="flex-1 overflow-y-auto py-3 relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-full px-3 lg:px-5">
          {conversation.messages.map((message, index) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              isLastMessage={index === conversation.messages.length - 1}
            />
          ))}
          
          <AnimatePresence>
            {showTyping && (
              <TypingIndicator />
            )}
          </AnimatePresence>
          
          <div ref={messagesEndRef} />
        </div>
      </motion.div>

      <ScrollToBottom 
        show={showScrollToBottom}
        newMessageCount={newMessageCount}
        onClick={handleScrollToBottom}
      />
    </>
  );
} 