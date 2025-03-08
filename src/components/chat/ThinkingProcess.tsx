import React, { useEffect, useState, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";

interface ThinkingProcessProps {
  content: string;
  isAnimated?: boolean;
  onAnimationComplete?: () => void;
}

export function ThinkingProcess({ 
  content, 
  isAnimated = true,
  onAnimationComplete 
}: ThinkingProcessProps) {
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayedContent, setDisplayedContent] = useState(content);
  
  // Simulate typing animation for the thinking process
  useEffect(() => {
    if (!isAnimated) {
      setDisplayedContent(content);
      if (onAnimationComplete) onAnimationComplete();
      return;
    }
    
    // If we want to simulate the typing effect, we gradually reveal the content
    const duration = Math.min(5000, content.length * 10); // Cap at 5 seconds
    let startTime: number;
    
    const animateTyping = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const charactersToShow = Math.floor(content.length * progress);
      
      setDisplayedContent(content.substring(0, charactersToShow));
      
      if (progress < 1) {
        requestAnimationFrame(animateTyping);
      } else {
        // When animation completes, add a simulated scroll animation
        if (containerRef.current) {
          controls.start({
            y: [0, -20, -10, -15, -10],
            transition: { duration: 2, ease: "easeInOut" }
          }).then(() => {
            // After both typing and scroll animations complete, notify parent
            if (onAnimationComplete) onAnimationComplete();
          });
        } else {
          if (onAnimationComplete) onAnimationComplete();
        }
      }
    };
    
    requestAnimationFrame(animateTyping);
  }, [content, isAnimated, controls, onAnimationComplete]);
  
  return (
    <motion.div 
      ref={containerRef}
      className="flex w-full mb-1"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "max-w-[80%] ml-10 bg-muted/50 border-dashed"
      )}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="font-semibold">Thinking process</span>
          </div>
          <div className="text-sm font-mono whitespace-pre-wrap text-muted-foreground overflow-auto max-h-[300px]">
            {displayedContent}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
} 