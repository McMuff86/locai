"use client";

import React from 'react';
import { Monitor } from 'lucide-react';

<<<<<<< HEAD
=======
/**
 * Shows a "Desktop only" message on small screens, renders children on desktop.
 * Uses pure CSS (hidden/block) so there's no hydration mismatch.
 */
>>>>>>> origin/sprint6/mem4-flow-template-history
export function DesktopOnlyGuard({
  children,
  title = 'Desktop erforderlich',
  description = 'Diese Funktion ist für Desktop-Bildschirme optimiert und auf mobilen Geräten nicht verfügbar.',
<<<<<<< HEAD
  breakpoint = 'lg',
=======
  breakpoint = 'lg', // lg = 1024px
>>>>>>> origin/sprint6/mem4-flow-template-history
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
<<<<<<< HEAD
=======
      {/* Mobile/tablet fallback */}
>>>>>>> origin/sprint6/mem4-flow-template-history
      <div className={`${showClass} flex-col items-center justify-center h-full p-8 text-center gap-4`}>
        <div className="rounded-full bg-muted/50 p-4">
          <Monitor className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="max-w-sm space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
<<<<<<< HEAD
=======

      {/* Desktop content */}
>>>>>>> origin/sprint6/mem4-flow-template-history
      <div className={`${hideClass} flex-col h-full min-h-0 flex-1`}>
        {children}
      </div>
    </>
  );
}
