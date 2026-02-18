/**
 * LocAI Tailwind Config Tokens
 * Sprint 5 — Design System v1.0
 *
 * Usage: Copy the relevant sections into tailwind.config.ts
 * Note: This project uses Tailwind CSS v4 with @theme inline in globals.css.
 *       These tokens are implemented as CSS custom properties (see globals.css).
 *       This file serves as the canonical source-of-truth for token values.
 *
 * Primary implementation: src/app/globals.css (Tailwind v4 @theme inline)
 * Secondary: This file (for documentation + potential v3-compat)
 */

// ============================================================================
// COLOR TOKENS
// ============================================================================

export const colors = {
  // ── LocAI Brand Colors ────────────────────────────────────────────────────
  locai: {
    // Cyan Accent (Primary Brand Color)
    cyan: {
      50:  'oklch(0.97 0.05 185)',
      100: 'oklch(0.92 0.09 185)',
      200: 'oklch(0.84 0.13 183)',
      400: 'oklch(0.75 0.17 182)',  // ← PRIMARY ACTION
      500: 'oklch(0.68 0.17 182)',
      600: 'oklch(0.58 0.15 180)',
      900: 'oklch(0.22 0.06 185)',
    },
    // Base Neutral (Zinc-inspired, slightly blue-grey)
    base: {
      50:  'oklch(0.97 0.005 265)',
      100: 'oklch(0.93 0.008 265)',
      200: 'oklch(0.87 0.010 265)',
      300: 'oklch(0.78 0.012 265)',
      400: 'oklch(0.62 0.015 265)',
      500: 'oklch(0.50 0.015 265)',
      600: 'oklch(0.38 0.018 265)',
      700: 'oklch(0.28 0.020 265)',
      750: 'oklch(0.22 0.020 265)',
      800: 'oklch(0.16 0.018 265)',
      850: 'oklch(0.12 0.015 265)',
      900: 'oklch(0.09 0.012 265)',
      950: 'oklch(0.07 0.010 265)',
    },
    // Semantic
    success: 'oklch(0.72 0.18 145)',  // Emerald
    warning: 'oklch(0.78 0.19 80)',   // Amber
    error:   'oklch(0.58 0.22 25)',   // Red
    info:    'oklch(0.68 0.17 255)',  // Blue
  },
} as const;

// ============================================================================
// CSS VARIABLES — globals.css @theme inline additions
// ============================================================================

/**
 * Paste into src/app/globals.css inside @theme inline { ... }
 *
 * These extend the existing Shadcn/UI variable definitions.
 */
export const cssThemeInlineAdditions = `
  /* ── LocAI Custom Tokens ─────────────────────────────────────────────── */

  /* Brand Colors */
  --color-locai-cyan-50:  oklch(0.97 0.05 185);
  --color-locai-cyan-100: oklch(0.92 0.09 185);
  --color-locai-cyan-200: oklch(0.84 0.13 183);
  --color-locai-cyan-400: oklch(0.75 0.17 182);
  --color-locai-cyan-500: oklch(0.68 0.17 182);
  --color-locai-cyan-600: oklch(0.58 0.15 180);
  --color-locai-cyan-900: oklch(0.22 0.06 185);

  /* Semantic Feedback */
  --color-locai-success:  oklch(0.72 0.18 145);
  --color-locai-warning:  oklch(0.78 0.19  80);
  --color-locai-error:    oklch(0.58 0.22  25);
  --color-locai-info:     oklch(0.68 0.17 255);

  /* Shadow Tokens */
  --shadow-glow-primary: 0 0 0 2px oklch(0.75 0.17 182 / 0.25),
                         0 0 12px oklch(0.75 0.17 182 / 0.15);
  --shadow-glow-success: 0 0 0 1px oklch(0.72 0.18 145 / 0.3),
                         0 0 8px oklch(0.72 0.18 145 / 0.12);
  --shadow-glow-error:   0 0 0 1px oklch(0.58 0.22 25 / 0.35),
                         0 0 8px oklch(0.58 0.22 25 / 0.15);

  /* Glass Morphism */
  --glass-blur-sm:  8px;
  --glass-blur-md:  12px;
  --glass-blur-lg:  16px;
  --glass-blur-xl:  24px;

  /* Animation Durations */
  --duration-instant:    50ms;
  --duration-fast:      150ms;
  --duration-normal:    250ms;
  --duration-slow:      350ms;
  --duration-deliberate: 500ms;

  /* Spacing tokens (on top of Tailwind defaults) */
  --sidebar-width-expanded:  224px;  /* w-56 */
  --sidebar-width-collapsed:  56px;  /* w-14 */
  --header-height:            56px;  /* h-14 */
  --chat-input-height:        56px;
`;

// ============================================================================
// TAILWIND v4 CSS CUSTOM PROPERTIES (globals.css replacements)
// ============================================================================

/**
 * Complete dark mode section for globals.css
 * Replaces the existing .dark { ... } block with refined values.
 */
export const darkModeVariables = `
.dark {
  /* ── Base Surfaces ─────────────────────────────────────────────────────── */
  --background:    oklch(0.08 0.010 265);   /* Deep blue-black */
  --foreground:    oklch(0.93 0.008 265);   /* Near-white */

  --card:          oklch(0.11 0.012 265);   /* Card surface */
  --card-foreground: oklch(0.93 0.008 265);

  --popover:       oklch(0.13 0.015 265);   /* Dialogs, Dropdowns */
  --popover-foreground: oklch(0.93 0.008 265);

  /* ── Brand / Actions ───────────────────────────────────────────────────── */
  --primary:       oklch(0.75 0.17 182);    /* Cyan Accent */
  --primary-foreground: oklch(0.07 0.010 265);

  /* ── Surface Variants ──────────────────────────────────────────────────── */
  --secondary:     oklch(0.16 0.015 265);
  --secondary-foreground: oklch(0.85 0.010 265);

  --muted:         oklch(0.15 0.013 265);
  --muted-foreground: oklch(0.58 0.018 265);

  --accent:        oklch(0.20 0.04  185);   /* Cyan-tinted bg for highlights */
  --accent-foreground: oklch(0.75 0.17 182);

  /* ── Feedback ──────────────────────────────────────────────────────────── */
  --destructive:   oklch(0.55 0.22 25);
  --destructive-foreground: oklch(0.97 0.02 25);

  /* ── Chrome ────────────────────────────────────────────────────────────── */
  --border:        oklch(0.22 0.018 265);
  --input:         oklch(0.17 0.015 265);
  --ring:          oklch(0.75 0.17 182);    /* Focus ring = Cyan */

  /* ── Chart Colors ──────────────────────────────────────────────────────── */
  --chart-1: oklch(0.75 0.17 182);   /* Cyan  */
  --chart-2: oklch(0.72 0.18 145);   /* Green */
  --chart-3: oklch(0.78 0.19  80);   /* Amber */
  --chart-4: oklch(0.65 0.22 300);   /* Purple */
  --chart-5: oklch(0.65 0.24  25);   /* Red */

  /* ── Sidebar ───────────────────────────────────────────────────────────── */
  --sidebar:       oklch(0.06 0.008 265);   /* Slightly darker than BG */
  --sidebar-foreground: oklch(0.85 0.010 265);
  --sidebar-primary: oklch(0.75 0.17 182);
  --sidebar-primary-foreground: oklch(0.06 0.008 265);
  --sidebar-accent: oklch(0.13 0.015 265);
  --sidebar-accent-foreground: oklch(0.75 0.17 182);
  --sidebar-border: oklch(0.18 0.015 265);
  --sidebar-ring:   oklch(0.75 0.17 182);
}
`;

// ============================================================================
// KEYFRAME ANIMATIONS (globals.css additions)
// ============================================================================

export const additionalKeyframes = `
/* ── Shimmer (Skeleton Loading — replaces animate-pulse) ─────────────────── */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

/* ── Status Pulse (running tool calls) ────────────────────────────────────── */
@keyframes status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.7; transform: scale(0.92); }
}

/* ── Gradient Flow (Active states) ───────────────────────────────────────── */
@keyframes gradient-flow {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
`;

// ============================================================================
// UTILITY CLASSES (globals.css @layer utilities additions)
// ============================================================================

export const utilityClasses = `
@layer utilities {
  /* Focus Ring — Cyan based, consistent */
  .focus-ring {
    @apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/50;
  }

  /* Shimmer Loading */
  .animate-shimmer {
    background: linear-gradient(
      90deg,
      var(--muted) 0%,
      color-mix(in oklch, var(--muted) 80%, white) 50%,
      var(--muted) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.8s ease-in-out infinite;
  }

  /* Status Pulse */
  .animate-status-pulse {
    animation: status-pulse 1.5s ease-in-out infinite;
  }

  /* Gradient Flow */
  .animate-gradient-flow {
    background-size: 200% 200%;
    animation: gradient-flow 4s ease infinite;
  }

  /* Glass Morphism Utilities */
  .glass-xs {
    background: oklch(0.10 0.012 265 / 0.60);
    backdrop-filter: blur(var(--glass-blur-sm, 8px)) saturate(1.2);
    border: 1px solid oklch(1 0 0 / 0.05);
  }

  .glass-sm {
    background: oklch(0.10 0.012 265 / 0.75);
    backdrop-filter: blur(var(--glass-blur-md, 12px)) saturate(1.4);
    border: 1px solid oklch(1 0 0 / 0.07);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .glass-md {
    background: oklch(0.09 0.010 265 / 0.85);
    backdrop-filter: blur(var(--glass-blur-lg, 16px)) saturate(1.6);
    border: 1px solid oklch(1 0 0 / 0.08);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .glass-lg {
    background: oklch(0.08 0.010 265 / 0.92);
    backdrop-filter: blur(var(--glass-blur-xl, 24px)) saturate(1.8);
    border: 1px solid oklch(1 0 0 / 0.06);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  }

  /* Glow Shadow Utilities */
  .shadow-glow-primary {
    box-shadow: var(--shadow-glow-primary,
      0 0 0 2px oklch(0.75 0.17 182 / 0.25),
      0 0 12px oklch(0.75 0.17 182 / 0.15)
    );
  }
  .shadow-glow-success {
    box-shadow: var(--shadow-glow-success,
      0 0 0 1px oklch(0.72 0.18 145 / 0.3),
      0 0 8px oklch(0.72 0.18 145 / 0.12)
    );
  }
  .shadow-glow-error {
    box-shadow: var(--shadow-glow-error,
      0 0 0 1px oklch(0.58 0.22 25 / 0.35),
      0 0 8px oklch(0.58 0.22 25 / 0.15)
    );
  }

  /* Text Truncation utilities */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
`;

// ============================================================================
// COMPONENT CLASSES (globals.css @layer components additions)
// ============================================================================

export const componentClasses = `
@layer components {
  /* ── Elevated Card (Shadcn Card Extension) ─────────────────────────────── */
  .card-elevated {
    @apply rounded-xl border border-border/40 bg-card shadow-sm;
  }

  /* ── Premium Card (Glass-like) ─────────────────────────────────────────── */
  .card-premium {
    @apply rounded-xl border border-white/5 bg-card/80;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  /* ── Chat Message Cards ────────────────────────────────────────────────── */
  .chat-bubble-user {
    @apply rounded-2xl rounded-tr-sm px-4 py-3;
    @apply border border-primary/15;
    background: linear-gradient(135deg,
      oklch(0.20 0.04 185 / 0.4) 0%,
      oklch(0.16 0.02 265 / 0.6) 50%,
      oklch(0.13 0.015 265 / 0.5) 100%
    );
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .chat-bubble-ai {
    @apply rounded-xl rounded-tl-sm px-4 py-3;
    @apply border border-border/50 bg-card/80;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  /* ── Tool Call Card Variants ───────────────────────────────────────────── */
  .tool-card-running {
    @apply rounded-lg border border-blue-500/30 overflow-hidden;
    background: oklch(0.11 0.012 265 / 0.8);
    box-shadow: 0 0 0 1px oklch(0.68 0.17 255 / 0.1),
                0 0 12px oklch(0.68 0.17 255 / 0.05);
  }

  .tool-card-success {
    @apply rounded-lg border border-emerald-500/20 overflow-hidden;
    background: oklch(0.11 0.012 265 / 0.6);
  }

  .tool-card-error {
    @apply rounded-lg border border-red-500/30 overflow-hidden;
    background: oklch(0.11 0.012 265 / 0.8);
    box-shadow: 0 0 0 1px oklch(0.58 0.22 25 / 0.1);
  }

  /* ── Code Block ────────────────────────────────────────────────────────── */
  .code-block {
    @apply rounded-lg overflow-hidden border border-border/40;
  }
  .code-block-header {
    @apply flex items-center justify-between px-4 py-2.5;
    background: oklch(0.07 0.010 265 / 0.95);
    @apply border-b border-border/30;
  }
  .code-block-body {
    @apply overflow-x-auto;
    background: oklch(0.06 0.008 265 / 0.90);
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  /* ── Toast ─────────────────────────────────────────────────────────────── */
  .toast-premium {
    @apply rounded-xl overflow-hidden;
    @apply border border-border/60;
    background: oklch(0.12 0.015 265 / 0.90);
    backdrop-filter: blur(12px) saturate(1.4);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  /* ── Sidebar ───────────────────────────────────────────────────────────── */
  .sidebar-nav-item {
    @apply flex items-center gap-3 px-3 py-2.5 rounded-lg;
    @apply transition-colors duration-150 relative;
    @apply text-muted-foreground hover:bg-muted/50 hover:text-foreground;
  }

  .sidebar-nav-item-active {
    @apply bg-primary/12 text-primary;
    box-shadow: inset 0 0 0 1px oklch(0.75 0.17 182 / 0.15);
  }

  /* ── Empty State ───────────────────────────────────────────────────────── */
  .empty-state-icon {
    @apply w-16 h-16 rounded-2xl;
    @apply bg-muted/50 flex items-center justify-center;
    @apply border border-border/40;
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.15);
  }
}
`;

// ============================================================================
// FRAMER MOTION TOKENS (for use in components)
// ============================================================================

export const motionTokens = {
  duration: {
    instant:    0.05,
    fast:       0.15,
    normal:     0.25,
    slow:       0.35,
    deliberate: 0.5,
  },
  ease: {
    out:      [0.0, 0.0, 0.2, 1.0] as [number, number, number, number],
    in:       [0.4, 0.0, 1.0, 1.0] as [number, number, number, number],
    inOut:    [0.4, 0.0, 0.2, 1.0] as [number, number, number, number],
    overshoot:[0.34, 1.56, 0.64, 1] as [number, number, number, number],
  },
  spring: {
    default:  { type: 'spring' as const, stiffness: 400, damping: 30 },
    bouncy:   { type: 'spring' as const, stiffness: 500, damping: 20 },
    tight:    { type: 'spring' as const, stiffness: 600, damping: 40 },
  },
  variants: {
    slideUp: {
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] } },
      exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
    },
    popIn: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] } },
      exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
    },
    slideRight: {
      initial: { opacity: 0, x: 48 },
      animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.0, 0.0, 0.2, 1.0] } },
      exit:    { opacity: 0, x: 48, transition: { duration: 0.2, ease: [0.4, 0.0, 1.0, 1.0] } },
    },
    expandHeight: {
      initial: { height: 0, opacity: 0 },
      animate: { height: 'auto' as const, opacity: 1, transition: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] } },
      exit:    { height: 0, opacity: 0, transition: { duration: 0.15 } },
    },
    staggerContainer: {
      animate: { transition: { staggerChildren: 0.04 } },
    },
    staggerItem: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    },
    messageEnter: {
      initial: { opacity: 0, y: 12, scale: 0.98 },
      animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] } },
    },
  },
  interactions: {
    tapButton:  { scale: 0.97 },
    hoverLift:  { y: -2 },
    hoverScale: { scale: 1.02 },
  },
} as const;

// ============================================================================
// LANG COLOR MAP (for CodeBlock component)
// ============================================================================

export const langColorMap: Record<string, string> = {
  typescript:  'bg-blue-400',
  tsx:         'bg-blue-400',
  javascript:  'bg-yellow-400',
  jsx:         'bg-yellow-400',
  python:      'bg-green-400',
  bash:        'bg-emerald-400',
  shell:       'bg-emerald-400',
  sh:          'bg-emerald-400',
  zsh:         'bg-emerald-400',
  css:         'bg-pink-400',
  scss:        'bg-pink-400',
  html:        'bg-orange-400',
  json:        'bg-yellow-300',
  yaml:        'bg-yellow-300',
  toml:        'bg-orange-300',
  markdown:    'bg-gray-400',
  md:          'bg-gray-400',
  rust:        'bg-orange-600',
  go:          'bg-cyan-400',
  sql:         'bg-purple-400',
  graphql:     'bg-pink-500',
  dockerfile:  'bg-blue-500',
  nginx:       'bg-green-600',
  xml:         'bg-orange-300',
  swift:       'bg-orange-500',
  kotlin:      'bg-purple-500',
  java:        'bg-red-500',
  csharp:      'bg-purple-600',
  cpp:         'bg-blue-600',
  c:           'bg-blue-700',
};

// ============================================================================
// TOOL EMOJI MAP (for ToolCallBlock component)
// ============================================================================

export const toolEmoji: Record<string, string> = {
  search_documents: '📄',
  web_search:       '🌐',
  read_file:        '📖',
  write_file:       '✍️',
  edit_file:        '✏️',
  create_note:      '📝',
  save_memory:      '🧠',
  recall_memory:    '💭',
  run_command:      '⚡',
  run_code:         '🔬',
  generate_image:   '🎨',
};

// ============================================================================
// RADIUS TOKENS
// ============================================================================

export const radius = {
  xs:   '4px',
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl':'20px',
  full: '9999px',
} as const;

// ============================================================================
// SHADOW TOKENS
// ============================================================================

export const shadows = {
  xs:  '0 1px 2px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.02)',
  sm:  '0 2px 8px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.2)',
  md:  '0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.25)',
  lg:  '0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)',
  xl:  '0 16px 48px rgba(0, 0, 0, 0.6), 0 8px 24px rgba(0, 0, 0, 0.35)',
  glowPrimary: '0 0 0 2px oklch(0.75 0.17 182 / 0.25), 0 0 12px oklch(0.75 0.17 182 / 0.15)',
  glowSuccess: '0 0 0 1px oklch(0.72 0.18 145 / 0.3), 0 0 8px oklch(0.72 0.18 145 / 0.12)',
  glowError:   '0 0 0 1px oklch(0.58 0.22 25 / 0.35), 0 0 8px oklch(0.58 0.22 25 / 0.15)',
} as const;
