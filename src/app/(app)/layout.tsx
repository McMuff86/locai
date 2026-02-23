"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import {
  MessageSquare,
  Image,
  FileText,
  Files,
  Moon,
  Sun,
  Menu,
  X,
  Settings,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Workflow,
  Terminal,
  Music,
  Brain,
} from 'lucide-react';
import Link from 'next/link';
import NextImage from 'next/image';
import { MigrationBanner } from '@/components/MigrationBanner';
import { motion, AnimatePresence } from 'framer-motion';

// ── Navigation sections ───────────────────────────────────────────

const navSections = [
  {
    label: 'Start',
    items: [{ href: '/flow', label: 'Flow', icon: Workflow }],
  },
  {
    label: 'Tools',
    items: [
      { href: '/chat',      label: 'Chat',      icon: MessageSquare },
      { href: '/search',    label: 'Suche',     icon: Search },
      { href: '/documents', label: 'Dokumente', icon: Files },
      { href: '/gallery',   label: 'Galerie',   icon: Image },
      { href: '/audio',     label: 'Audio',     icon: Music },
      { href: '/notes',     label: 'Notizen',   icon: FileText },
      { href: '/terminal',  label: 'Terminal',  icon: Terminal },
      { href: '/memories',  label: 'Memories',  icon: Brain },
    ],
  },
  {
    label: 'Einstellungen',
    items: [{ href: '/settings', label: 'Einstellungen', icon: Settings }],
  },
];

const SIDEBAR_COLLAPSED_KEY = 'locai-sidebar-collapsed';

// ── Simple CSS tooltip wrapper ────────────────────────────────────

function SideTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <div className="group/tip relative">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap rounded-md bg-popover border border-border/60 px-2.5 py-1 text-xs text-foreground shadow-md opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
        {label}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────

function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="px-3 py-2 flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-muted-foreground/30">–</span>
    </div>
  );
}

// ── NavItem ───────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  onClick,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  return (
    <SideTooltip label={label} enabled={!!collapsed}>
      <Link href={href} onClick={onClick}>
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
            collapsed ? 'justify-center px-0' : ''
          } ${
            isActive
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          {/* Animated active indicator */}
          {isActive && (
            <motion.span
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            />
          )}

          <Icon className="h-5 w-5 flex-shrink-0" />

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="label"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className={`text-sm overflow-hidden whitespace-nowrap ${isActive ? 'font-medium' : ''}`}
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </Link>
    </SideTooltip>
  );
}

// ── AppLayout ─────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored !== null) setCollapsed(stored === 'true');
    } catch { /* ignore */ }
  }, []);

  // ── Auto-start services on mount ──────────────────────────────────
  const autoStartRan = useRef(false);
  useEffect(() => {
    if (autoStartRan.current) return;
    autoStartRan.current = true;

    (async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (!data.success) return;
        const s = data.settings;

        // ComfyUI auto-start
        if (s.comfyUIAutoStart && s.comfyUIPath) {
          try {
            const health = await fetch(`/api/comfyui/status?port=${s.comfyUIPort || 8188}`);
            const info = await health.json();
            if (!info.running) {
              await fetch('/api/comfyui/launch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comfyUIPath: s.comfyUIPath }),
              });
              console.log('[auto-start] ComfyUI launch initiated');
            }
          } catch { /* ignore */ }
        }

        // ACE-Step auto-start
        if (s.aceStepAutoStart && s.aceStepPath) {
          try {
            const health = await fetch('/api/ace-step/health', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            });
            if (!health.ok) {
              await fetch('/api/ace-step/launch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aceStepPath: s.aceStepPath }),
              });
              console.log('[auto-start] ACE-Step launch initiated');
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore settings fetch error */ }
    })();
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/');

  const themeLabel = mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  const ThemeIcon  = mounted && theme === 'dark' ? Sun : Moon;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Desktop Sidebar ── */}
      <motion.nav
        layout
        animate={{ width: collapsed ? 56 : 224 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="hidden md:flex flex-col bg-sidebar border-r border-border/60 overflow-hidden flex-shrink-0"
      >
        {/* Logo / Brand */}
        <Link
          href="/"
          className={`flex items-center gap-3 h-14 border-b border-border/60 hover:bg-accent/50 transition-colors flex-shrink-0 ${
            collapsed ? 'justify-center px-0' : 'px-4'
          }`}
        >
          <NextImage
            src="/LocAI_logo_v0.2.svg"
            alt="LocAI"
            width={28}
            height={28}
            className="flex-shrink-0"
          />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="brand-text"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col leading-none overflow-hidden whitespace-nowrap"
              >
                <span className="text-sm font-bold tracking-wide">LOCAI</span>
                <span className="text-[10px] text-muted-foreground tracking-wider">
                  LOCAL AI ASSISTANT
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        {/* Nav sections */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-1 ${collapsed ? 'px-1' : 'px-2'}`}>
          {navSections.map((section) => (
            <div key={section.label}>
              <SectionHeader label={section.label} collapsed={collapsed} />
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    isActive={isActive(item.href)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom: Collapse + Theme */}
        <div className={`pb-4 space-y-1 flex-shrink-0 ${collapsed ? 'px-1' : 'px-2'}`}>
          {/* Collapse toggle */}
          <SideTooltip label="Ausklappen" enabled={collapsed}>
            <button
              onClick={toggleCollapse}
              className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors ${
                collapsed ? 'justify-center px-0' : ''
              }`}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5 flex-shrink-0" />
              ) : (
                <>
                  <PanelLeftClose className="h-5 w-5 flex-shrink-0" />
                  <AnimatePresence initial={false}>
                    <motion.span
                      key="collapse-label"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm whitespace-nowrap overflow-hidden"
                    >
                      Einklappen
                    </motion.span>
                  </AnimatePresence>
                </>
              )}
            </button>
          </SideTooltip>

          {/* Theme toggle */}
          <SideTooltip label={themeLabel} enabled={collapsed}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors ${
                collapsed ? 'justify-center px-0' : ''
              }`}
            >
              <ThemeIcon className="h-5 w-5 flex-shrink-0" />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    key="theme-label"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm whitespace-nowrap overflow-hidden"
                  >
                    {themeLabel}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </SideTooltip>
        </div>
      </motion.nav>

      {/* ── Mobile Navigation ── */}
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
            <NextImage src="/LocAI_logo_v0.2.svg" alt="LocAI" width={24} height={24} />
            <span className="font-semibold text-sm tracking-wide">LOCAI</span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {mounted && theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        {showMobileNav && (
          <div className="absolute top-14 left-0 right-0 bg-background border-b border-border shadow-lg">
            <div className="p-2 space-y-1">
              {navSections.map((section) => (
                <div key={section.label}>
                  <SectionHeader label={section.label} collapsed={false} />
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
      <main className="flex-1 overflow-hidden md:pt-0 pt-14 flex flex-col min-w-0">
        <MigrationBanner />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
