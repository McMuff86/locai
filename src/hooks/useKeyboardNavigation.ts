"use client";

import { useEffect, useRef } from 'react';

export interface KeyboardNavigationItem {
  id: string;
  element?: HTMLElement | null;
}

interface UseKeyboardNavigationOptions {
  items: KeyboardNavigationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate?: (id: string) => void;
  onEscape?: () => void;
  enabled?: boolean;
  containerRef?: React.RefObject<HTMLElement>;
}

export function useKeyboardNavigation({
  items,
  selectedId,
  onSelect,
  onActivate,
  onEscape,
  enabled = true,
  containerRef
}: UseKeyboardNavigationOptions) {
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle navigation if focus is in the container or no specific container
      const container = containerRef?.current;
      const activeElement = document.activeElement;
      
      if (container && !container.contains(activeElement)) {
        return;
      }

      const currentIndex = selectedId ? items.findIndex(item => item.id === selectedId) : -1;
      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          
          if (items.length === 0) return;
          
          if (e.key === 'ArrowUp') {
            nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
          } else {
            nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
          }

          const nextItem = items[nextIndex];
          if (nextItem) {
            isNavigatingRef.current = true;
            onSelect(nextItem.id);
            
            // Scroll item into view if element is provided
            if (nextItem.element) {
              nextItem.element.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              });
            }
            
            // Reset navigation flag after a short delay
            setTimeout(() => {
              isNavigatingRef.current = false;
            }, 100);
          }
          break;
        }
        
        case 'Enter': {
          e.preventDefault();
          if (selectedId && onActivate) {
            onActivate(selectedId);
          }
          break;
        }
        
        case 'Escape': {
          e.preventDefault();
          if (onEscape) {
            onEscape();
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [items, selectedId, onSelect, onActivate, onEscape, enabled, containerRef]);

  return {
    isNavigating: isNavigatingRef.current,
  };
}