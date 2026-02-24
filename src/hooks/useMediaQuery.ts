"use client";

import { useState, useEffect } from 'react';

/**
 * React hook that listens to a CSS media query.
 * Returns `true` when the query matches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** True on screens < 768px */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/** True on screens < 1024px (mobile + tablet) */
export function useIsTabletOrBelow(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
