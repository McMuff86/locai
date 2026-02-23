"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScrollToBottomProps {
  show: boolean;
  newMessageCount?: number;
  onClick: () => void;
  className?: string;
}

export function ScrollToBottom({ 
  show, 
  newMessageCount = 0, 
  onClick, 
  className 
}: ScrollToBottomProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={cn("fixed bottom-32 right-6 z-10", className)}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Button
            onClick={onClick}
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full shadow-lg",
              "bg-zinc-800 hover:bg-zinc-700 border border-zinc-600",
              "text-zinc-200 hover:text-white",
              "transition-all duration-200",
              newMessageCount > 0 && "ring-2 ring-cyan-400/30"
            )}
          >
            <ChevronDown className="h-5 w-5" />
            {newMessageCount > 0 && (
              <motion.div
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-cyan-400 text-black text-xs font-semibold flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {newMessageCount > 9 ? '9+' : newMessageCount}
              </motion.div>
            )}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}