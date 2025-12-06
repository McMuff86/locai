"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Monitor, 
  ChevronLeft, 
  ChevronRight, 
  GripVertical, 
  X,
  Pin,
  PinOff,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { GpuMonitorWidget } from './GpuMonitorWidget';
import { cn } from '../lib/utils';

interface RightSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isGenerating?: boolean;
}

type WidgetId = 'gpu-monitor';

interface WidgetConfig {
  id: WidgetId;
  title: string;
  icon: React.ReactNode;
  isMinimized: boolean;
  isPinned: boolean;
}

export function RightSidebar({ isOpen, onToggle, isGenerating = false }: RightSidebarProps) {
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    {
      id: 'gpu-monitor',
      title: 'GPU Monitor',
      icon: <Monitor className="h-4 w-4" />,
      isMinimized: false,
      isPinned: true
    }
  ]);

  // Handle resizing
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResize = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 600) {
        setWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing, resize, stopResize]);

  // Toggle widget minimized state
  const toggleMinimize = (widgetId: WidgetId) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, isMinimized: !w.isMinimized } : w
    ));
  };

  // Toggle widget pinned state
  const togglePin = (widgetId: WidgetId) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, isPinned: !w.isPinned } : w
    ));
  };

  // Remove widget
  const removeWidget = (widgetId: WidgetId) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  };

  // Add widget back
  const addWidget = (widgetId: WidgetId) => {
    if (!widgets.find(w => w.id === widgetId)) {
      const defaultWidgets: Record<WidgetId, WidgetConfig> = {
        'gpu-monitor': {
          id: 'gpu-monitor',
          title: 'GPU Monitor',
          icon: <Monitor className="h-4 w-4" />,
          isMinimized: false,
          isPinned: false
        }
      };
      setWidgets(prev => [...prev, defaultWidgets[widgetId]]);
    }
  };

  return (
    <>
      {/* Toggle Button (always visible) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-40 h-12 w-6 rounded-l-lg rounded-r-none",
          "bg-card border border-r-0 border-border shadow-lg",
          "hover:bg-accent transition-all duration-200",
          isOpen && "opacity-0 pointer-events-none"
        )}
        title="Open Tools Panel"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ width }}
            className={cn(
              "fixed right-0 top-0 h-full z-50",
              "bg-background/95 backdrop-blur-sm border-l border-border",
              "flex flex-col shadow-2xl"
            )}
          >
            {/* Resize Handle */}
            <div
              onMouseDown={startResize}
              className={cn(
                "absolute left-0 top-0 h-full w-1 cursor-ew-resize",
                "hover:bg-primary/50 transition-colors",
                isResizing && "bg-primary"
              )}
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 p-1 rounded bg-border">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-card/50">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                <span className="font-semibold">Tools Panel</span>
              </div>
              <div className="flex items-center gap-1">
                {/* Add Widget Button */}
                {!widgets.find(w => w.id === 'gpu-monitor') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addWidget('gpu-monitor')}
                    className="text-xs"
                  >
                    + GPU Monitor
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Widgets Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {widgets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No widgets active</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addWidget('gpu-monitor')}
                    className="mt-4"
                  >
                    Add GPU Monitor
                  </Button>
                </div>
              ) : (
                widgets.map(widget => (
                  <div
                    key={widget.id}
                    className={cn(
                      "rounded-lg border bg-card overflow-hidden",
                      widget.isPinned && "ring-1 ring-primary/30"
                    )}
                  >
                    {/* Widget Header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                      <div className="flex items-center gap-2">
                        {widget.icon}
                        <span className="text-sm font-medium">{widget.title}</span>
                        {widget.isPinned && (
                          <Pin className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => togglePin(widget.id)}
                          title={widget.isPinned ? 'Unpin' : 'Pin'}
                        >
                          {widget.isPinned ? (
                            <PinOff className="h-3 w-3" />
                          ) : (
                            <Pin className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleMinimize(widget.id)}
                          title={widget.isMinimized ? 'Expand' : 'Minimize'}
                        >
                          {widget.isMinimized ? (
                            <Maximize2 className="h-3 w-3" />
                          ) : (
                            <Minimize2 className="h-3 w-3" />
                          )}
                        </Button>
                        {!widget.isPinned && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeWidget(widget.id)}
                            title="Close"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Widget Content */}
                    <AnimatePresence>
                      {!widget.isMinimized && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {widget.id === 'gpu-monitor' && (
                            <GpuMonitorWidget isGenerating={isGenerating} />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t bg-card/50 text-xs text-muted-foreground text-center">
              Drag left edge to resize
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay when open on mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default RightSidebar;

