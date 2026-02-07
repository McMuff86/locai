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

// Section definitions for grouped navigation
const navSections = [
  {
    label: 'Chat',
    items: [
      { href: '/chat', label: 'Chat', icon: MessageSquare },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/search', label: 'Suche', icon: Search },
      { href: '/gallery', label: 'Galerie', icon: Image },
      { href: '/notes', label: 'Notizen', icon: FileText },
    ],
  },
  {
    label: 'Einstellungen',
    items: [
      { href: '/settings', label: 'Einstellungen', icon: Settings },
    ],
  },
];

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 py-2 flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-muted-foreground/30">–</span>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick}>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative ${
          isActive
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
        )}
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span className={`text-sm ${isActive ? 'font-medium' : ''}`}>
          {label}
        </span>
      </div>
    </Link>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/');

  const themeLabel = mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  const ThemeIcon = mounted && theme === 'dark' ? Sun : Moon;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Desktop Sidebar ── */}
      <nav className="hidden md:flex flex-col w-56 bg-sidebar border-r border-border/60">
        {/* Logo / Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 px-4 h-14 border-b border-border/60 hover:bg-accent/50 transition-colors"
        >
          <NextImage
            src="/LocAI_logo_v0.2.svg"
            alt="LocAI"
            width={28}
            height={28}
            className="flex-shrink-0"
          />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-wide">LOCAI</span>
            <span className="text-[10px] text-muted-foreground tracking-wider">
              LOCAL AI ASSISTANT
            </span>
          </div>
        </Link>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {navSections.map((section) => (
            <div key={section.label}>
              <SectionHeader label={section.label} />
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    isActive={isActive(item.href)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Theme Toggle */}
        <div className="px-2 pb-4">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <ThemeIcon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{themeLabel}</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile Navigation ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMobileNav(!showMobileNav)}
          >
            {showMobileNav ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          <Link href="/" className="flex items-center gap-2">
            <NextImage
              src="/LocAI_logo_v0.2.svg"
              alt="LocAI"
              width={24}
              height={24}
            />
            <span className="font-semibold text-sm tracking-wide">LOCAI</span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {mounted && theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Mobile Nav Dropdown – sectioned */}
        {showMobileNav && (
          <div className="absolute top-14 left-0 right-0 bg-background border-b border-border shadow-lg">
            <div className="p-2 space-y-1">
              {navSections.map((section) => (
                <div key={section.label}>
                  <SectionHeader label={section.label} />
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <NavItem
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        isActive={isActive(item.href)}
                        onClick={() => setShowMobileNav(false)}
                      />
                    ))}
                  </div>
                </div>
              ))}
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

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-hidden md:pt-0 pt-14">
        {children}
      </main>
    </div>
  );
}
