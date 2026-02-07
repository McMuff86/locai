"use client";

import { useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';

/**
 * Syncs the fontSize setting to the <html> element's data-font-size attribute.
 * This drives the CSS custom property --font-size-base / --font-size-chat.
 */
export function FontSizeSync() {
  const { settings, isLoaded } = useSettings();

  useEffect(() => {
    if (!isLoaded) return;
    const fontSize = settings?.fontSize || 'medium';
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [settings?.fontSize, isLoaded]);

  return null;
}
