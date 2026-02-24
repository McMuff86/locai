"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ConversationSummary } from '@/lib/conversations/types';

interface ConversationPreviewProps {
  conversation: ConversationSummary;
  show: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ConversationPreview({ 
  conversation, 
  show, 
  children, 
  className 
}: ConversationPreviewProps) {
  // Get first line of conversation (first user message or title)
  const preview = React.useMemo(() => {
    if (conversation.title && conversation.title.length > 0) {
      return conversation.title;
    }
    // Fallback to a generic preview
    return "Unterhaltung";
  }, [conversation.title]);

  return (
    <div className={cn("relative", className)}>
      {children}
      
      <AnimatePresence>
        {show && preview && (
          <motion.div
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="relative">
              {/* Arrow */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rotate-45 bg-popover border-l border-t border-border" />
              
              {/* Content */}
              <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm max-w-xs">
                <p className="text-sm text-popover-foreground line-clamp-2">
                  {preview}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}