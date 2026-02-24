"use client";

import React from 'react';
import { Monitor } from 'lucide-react';

/**
 * Shows a "Desktop only" message on small screens, renders children on desktop.
 * Uses pure CSS (hidden/block) so there's no hydration mismatch.
 */
export function DesktopOnlyGuard({
  children,
  title = 'Desktop erforderlich',
  description = 'Diese Funktion ist für Desktop-Bildschirme optimiert und auf mobilen Geräten nicht verfügbar.',
  breakpoint = 'lg', // lg = 1024px
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  breakpoint?: 'md' | 'lg';
}) {
  const showClass = breakpoint === 'md' ? 'md:hidden' : 'lg:hidden';
  const hideClass = breakpoint === 'md' ? 'hidden md:flex' : 'hidden lg:flex';

  return (
    <>
      {/* Mobile/tablet fallback */}
      <div className={`${showClass} flex-col items-center justify-center h-full p-8 text-center gap-4`}>
        <div className="rounded-full bg-muted/50 p-4">
          <Monitor className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="max-w-sm space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Desktop content */}
      <div className={`${hideClass} flex-col h-full min-h-0 flex-1`}>
        {children}
      </div>
    </>
  );
}
