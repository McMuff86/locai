"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { 
  MessageSquare, 
  Image, 
  FileText, 
  Moon,
  Sun,
  Menu,
  X,
  Settings,
  Search
} from 'lucide-react';
import Link from 'next/link';
import NextImage from 'next/image';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Navigation items
  const navItems = [
    { href: '/chat', label: 'Chat', icon: MessageSquare },
    { href: '/search', label: 'Suche', icon: Search },
    { href: '/gallery', label: 'Galerie', icon: Image },
    { href: '/notes', label: 'Notizen', icon: FileText },
    { href: '/settings', label: 'Einstellungen', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Vertical Navigation Bar */}
      <nav className="hidden md:flex flex-col w-16 bg-sidebar border-r border-border/60">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center h-14 border-b border-border hover:bg-accent/50 transition-colors">
          <NextImage
            src="/LocAI_logo_v0.2.svg"
            alt="LocAI"
            width={28}
            height={28}
            className="flex-shrink-0"
          />
        </Link>

        {/* Nav Items */}
        <div className="flex-1 flex flex-col items-center py-4 gap-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} title={item.label}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="icon"
                  className={`w-12 h-12 relative ${
                    isActive 
                      ? 'bg-primary/15 text-primary shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  <item.icon className="h-[22px] w-[22px]" />
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />
                  )}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Theme Toggle */}
        <div className="pb-4 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-12 h-12 text-muted-foreground hover:text-foreground"
          >
            {mounted && theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMobileNav(!showMobileNav)}
          >
            {showMobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          
          <Link href="/" className="flex items-center gap-2">
            <NextImage src="/bot-avatar.png" alt="LocAI" width={24} height={24} className="rounded-md" />
            <span className="font-semibold">LocAI</span>
          </Link>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {mounted && theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Nav Dropdown */}
        {showMobileNav && (
          <div className="absolute top-14 left-0 right-0 bg-background border-b border-border shadow-lg">
            <div className="p-2 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={`w-full justify-start gap-3 ${isActive ? 'bg-primary/15 text-primary' : ''}`}
                      onClick={() => setShowMobileNav(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Overlay */}
      {showMobileNav && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setShowMobileNav(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden md:pt-0 pt-14">
        {children}
      </main>
    </div>
  );
}

