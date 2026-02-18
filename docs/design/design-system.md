# LocAI Design System
> Version 1.0 — Sprint 5: Agent Evolution & Premium Polish
> Erstellt: 2026-02-18 | Branch: sprint5/ui-design-system

---

## 1. Design Philosophy

**Leitmotiv:** "Precision Dark" — wie ein professionelles Terminal-Tool, das auch schön ist.

- **Dark-first:** Das dunkle Theme ist primär; Light ist sekundär
- **Clean > Clever:** Kein unnötiger Schnickschnack, jedes Element trägt zur UX bei
- **Performance-aware:** Animationen dürfen Ollama-Streaming nie blockieren
- **Extend, not replace:** Shadcn/UI-Components erweitern, nicht ersetzen

---

## 2. Color Palette

### Entscheidung: Cyan (Teal) als Accent ✓

**Begründung:** Das bestehende Theme nutzt bereits Teal/Cyan (`oklch(0.75 0.15 180)`). Cyan passt zur "lokale AI"-Ästhetik (Terminal, Grok-Stil) und ist im dunklen Modus besser lesbar als Violet. Violet wäre zu "produkt-ig", Cyan kommuniziert Präzision + Tech.

### CSS Custom Properties (Dark Mode Primary)

```css
/* ── Brand & Accent ─────────────────────────────────────── */
--locai-cyan-50:   oklch(0.97 0.05 185);   /* Ganz helles Cyan – Hover Highlights */
--locai-cyan-100:  oklch(0.92 0.09 185);   /* Light Cyan – Subtle Badges */
--locai-cyan-200:  oklch(0.84 0.13 183);   /* Cyan Background tints */
--locai-cyan-400:  oklch(0.75 0.17 182);   /* Primary Action Color (Buttons, Focus) */
--locai-cyan-500:  oklch(0.68 0.17 182);   /* Active States */
--locai-cyan-600:  oklch(0.58 0.15 180);   /* Hover auf cyan Elementen */
--locai-cyan-900:  oklch(0.22 0.06 185);   /* Cyan tinted Background (Accent Areas) */

/* ── Neutral Base (Zinc-inspired, leicht blau-grau) ─────── */
--locai-base-50:   oklch(0.97 0.005 265);  /* White-ish (Light Mode BG) */
--locai-base-100:  oklch(0.93 0.008 265);  /* Light Mode Card BG */
--locai-base-200:  oklch(0.87 0.010 265);  /* Light Mode Borders */
--locai-base-300:  oklch(0.78 0.012 265);  /* Light Mode Muted Text */
--locai-base-400:  oklch(0.62 0.015 265);  /* Muted Foreground */
--locai-base-500:  oklch(0.50 0.015 265);  /* Secondary Text */
--locai-base-600:  oklch(0.38 0.018 265);  /* Dark Mode Borders Strong */
--locai-base-700:  oklch(0.28 0.020 265);  /* Dark Mode Card BG */
--locai-base-750:  oklch(0.22 0.020 265);  /* Dark Mode Border */
--locai-base-800:  oklch(0.16 0.018 265);  /* Dark Mode Muted BG */
--locai-base-850:  oklch(0.12 0.015 265);  /* Dark Mode Card */
--locai-base-900:  oklch(0.09 0.012 265);  /* Dark Mode Sidebar */
--locai-base-950:  oklch(0.07 0.010 265);  /* Dark Mode Background */

/* ── Semantic Colors ─────────────────────────────────────── */
--locai-success:   oklch(0.72 0.18 145);   /* Emerald – Tool success */
--locai-warning:   oklch(0.78 0.19  80);   /* Amber – Warnings */
--locai-error:     oklch(0.58 0.22  25);   /* Red – Errors, destructive */
--locai-info:      oklch(0.68 0.17 255);   /* Blue – Info states */

/* ── Glass Morphism ──────────────────────────────────────── */
--locai-glass-bg:       rgba(18, 18, 28, 0.75);
--locai-glass-border:   rgba(255, 255, 255, 0.07);
--locai-glass-shadow:   0 8px 32px rgba(0, 0, 0, 0.4);
```

### Dark Theme Mapping (Override Shadcn Variables)

```css
.dark {
  --background:    oklch(0.08 0.010 265);   /* #080b11 äquivalent */
  --foreground:    oklch(0.93 0.008 265);   /* Near-white */
  
  --card:          oklch(0.11 0.012 265);   /* Leicht heller als BG */
  --card-foreground: oklch(0.93 0.008 265);
  
  --popover:       oklch(0.13 0.015 265);   /* Dialogs, Dropdowns */
  --popover-foreground: oklch(0.93 0.008 265);
  
  --primary:       oklch(0.75 0.17 182);    /* Cyan Accent */
  --primary-foreground: oklch(0.07 0.010 265);
  
  --secondary:     oklch(0.16 0.015 265);
  --secondary-foreground: oklch(0.85 0.010 265);
  
  --muted:         oklch(0.15 0.013 265);
  --muted-foreground: oklch(0.58 0.018 265);
  
  --accent:        oklch(0.20 0.04  185);   /* Cyan-tinted BG */
  --accent-foreground: oklch(0.75 0.17 182);
  
  --destructive:   oklch(0.55 0.22 25);
  --destructive-foreground: oklch(0.97 0.02 25);
  
  --border:        oklch(0.22 0.018 265);
  --input:         oklch(0.17 0.015 265);
  --ring:          oklch(0.75 0.17 182);    /* Focus ring = Cyan */
  
  --sidebar:       oklch(0.06 0.008 265);   /* Sidebar etwas dunkler */
  --sidebar-foreground: oklch(0.85 0.010 265);
  --sidebar-primary: oklch(0.75 0.17 182);
  --sidebar-primary-foreground: oklch(0.06 0.008 265);
  --sidebar-accent: oklch(0.13 0.015 265);
  --sidebar-accent-foreground: oklch(0.75 0.17 182);
  --sidebar-border: oklch(0.18 0.015 265);
  --sidebar-ring:   oklch(0.75 0.17 182);
}
```

### Light Theme Mapping

```css
:root {
  --background:    oklch(0.98 0.003 265);
  --foreground:    oklch(0.12 0.025 265);
  
  --card:          oklch(1.00 0.000 265);
  --card-foreground: oklch(0.12 0.025 265);
  
  --primary:       oklch(0.55 0.17 182);   /* Cyan dunkler für Light */
  --primary-foreground: oklch(0.98 0.003 265);
  
  --muted:         oklch(0.95 0.005 265);
  --muted-foreground: oklch(0.52 0.022 265);
  
  --accent:        oklch(0.92 0.08 185);   /* Light Cyan tint */
  --accent-foreground: oklch(0.35 0.15 182);
  
  --border:        oklch(0.90 0.007 265);
  --input:         oklch(0.93 0.006 265);
  --ring:          oklch(0.55 0.17 182);
}
```

---

## 3. Typography

### Entscheidung: Geist (bereits installiert) ✓

**Begründung:** Das Projekt verwendet schon `--font-geist-sans` und `--font-geist-mono`. Geist wurde von Vercel für Developer-Tools entwickelt – passt perfekt zu LocAI. Inter wäre redundant.

### Font Stack

```css
--font-sans: var(--font-geist-sans), 'Inter', system-ui, sans-serif;
--font-mono: var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', monospace;
```

### Type Scale (4px Grid-aligned)

| Token       | Size (rem) | px   | Weight | Line Height | Usage                        |
|-------------|-----------|------|--------|-------------|------------------------------|
| `text-xs`   | 0.75rem   | 12px | 400    | 1.5         | Labels, Timestamps, Badges   |
| `text-sm`   | 0.875rem  | 14px | 400    | 1.5         | Secondary text, Nav labels   |
| `text-base` | 0.9375rem | 15px | 400    | 1.625       | Chat messages (var CSS)      |
| `text-md`   | 1rem      | 16px | 500    | 1.5         | Body text, Card content      |
| `text-lg`   | 1.125rem  | 18px | 600    | 1.4         | Section headers, Card titles |
| `text-xl`   | 1.25rem   | 20px | 600    | 1.3         | Page titles                  |
| `text-2xl`  | 1.5rem    | 24px | 700    | 1.25        | Feature headings             |
| `text-3xl`  | 1.875rem  | 30px | 700    | 1.2         | Hero text                    |

### Typography Rules

```css
/* Chat-spezifische Schriftgrösse (user-kontrollierbar) */
--font-size-base: 0.9375rem;  /* 15px default */
--font-size-chat: 0.9375rem;

/* Mono für Code, Timestamps, Badges */
.font-mono-feature {
  font-family: var(--font-mono);
  font-feature-settings: "ss01", "ss02", "zero";  /* Geist Mono Stylistic Sets */
}

/* Heading Tracking */
.heading-tight { letter-spacing: -0.02em; }    /* h1, h2 */
.heading-normal { letter-spacing: -0.01em; }   /* h3, h4 */
.label-wide { letter-spacing: 0.06em; }        /* UPPERCASE Labels */
```

---

## 4. Spacing System (4px Grid)

```
4px  → 1 unit  → Tailwind: gap-1, p-1, m-1
8px  → 2 units → Tailwind: gap-2, p-2, m-2
12px → 3 units → Tailwind: gap-3, p-3, m-3
16px → 4 units → Tailwind: gap-4, p-4, m-4 (Base spacing)
20px → 5 units → Tailwind: gap-5, p-5, m-5
24px → 6 units → Tailwind: gap-6, p-6, m-6
32px → 8 units → Tailwind: gap-8, p-8, m-8
40px → 10 units
48px → 12 units → Sidebar icon width
56px → 14 units → Header height
64px → 16 units
```

### Component Spacing Guide

| Component              | Padding     | Gap     | Notes                         |
|------------------------|-------------|---------|-------------------------------|
| Sidebar nav item       | `px-3 py-2` | `gap-3` | 12px H, 8px V                 |
| Chat message card      | `p-4`       | —       | 16px alle Seiten              |
| Chat input area        | `p-4`       | `gap-2` | Bottom sticky area            |
| Tool call block        | `px-3 py-2` | `gap-2` | Kompakter Header              |
| Dialog/Modal           | `p-6`       | —       | 24px Padding                  |
| Card (standard)        | `p-4`       | —       | 16px innen                    |
| Card (compact)         | `p-3`       | —       | 12px für Dense UIs            |
| Section header         | `px-3 py-2` | —       | Nav section labels            |
| Toast notification     | `px-4 py-3` | `gap-3` | Kompakter als Alert           |

---

## 5. Border Radius Convention

```css
/* Radius Scale */
--radius-xs:  4px;   /* Tags, Badges, Chips */
--radius-sm:  6px;   /* Buttons (small), Inputs (inline) */
--radius-md:  8px;   /* Buttons (default), Form Inputs */
--radius-lg:  12px;  /* Cards, Dialog, Panels */
--radius-xl:  16px;  /* Large Cards, Modals */
--radius-2xl: 20px;  /* Featured Cards (Gallery) */
--radius-full: 9999px; /* Pills, Avatars */
```

### Component Radius Mapping

| Element              | Radius     | Tailwind Token  |
|----------------------|-----------|-----------------|
| Chat message card    | 12px      | `rounded-xl`    |
| User message bubble  | 16px      | `rounded-2xl`   |
| AI message content   | 12px      | `rounded-xl`    |
| Buttons (default)    | 8px       | `rounded-lg`    |
| Buttons (icon only)  | 8px       | `rounded-lg`    |
| Input fields         | 8px       | `rounded-lg`    |
| Toast                | 12px      | `rounded-xl`    |
| Tool call block      | 8px       | `rounded-lg`    |
| Badges / Tags        | 4px       | `rounded-sm`    |
| Avatar               | full      | `rounded-full`  |
| Sidebar              | 0         | flat            |
| Dialog               | 16px      | `rounded-2xl`   |
| Code block           | 8px       | `rounded-lg`    |
| Skeleton             | 6px       | `rounded-md`    |

---

## 6. Shadow System (Elevation Levels)

Shadows sind im Dark Mode subtiler (dunkler Hintergrund = weniger Kontrast-Bedarf). Die Schatten kommunizieren Ebenen, nicht Ästhetik.

```css
/* ── Elevation Tokens ────────────────────────────────────── */

/* Elevation 0 – Flat (Cards auf Surface-Level) */
--shadow-none: none;

/* Elevation 1 – Subtle (Input focus, hover states) */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.3),
             0 0 0 1px rgba(255, 255, 255, 0.02);

/* Elevation 2 – Low (Standard Cards, Sidebar items) */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.35),
             0 1px 3px rgba(0, 0, 0, 0.2);

/* Elevation 3 – Medium (Dropdowns, Tooltips, Popovers) */
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4),
             0 2px 6px rgba(0, 0, 0, 0.25);

/* Elevation 4 – High (Dialogs, Modals) */
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5),
             0 4px 12px rgba(0, 0, 0, 0.3);

/* Elevation 5 – Overlay (Floating elements) */
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.6),
             0 8px 24px rgba(0, 0, 0, 0.35);

/* ── Glow Effects (Accent/Status) ───────────────────────── */

/* Primary Cyan Glow (Focus, Active) */
--shadow-glow-primary: 0 0 0 2px oklch(0.75 0.17 182 / 0.25),
                       0 0 12px oklch(0.75 0.17 182 / 0.15);

/* Success Glow (Tool success) */
--shadow-glow-success: 0 0 0 1px oklch(0.72 0.18 145 / 0.3),
                       0 0 8px oklch(0.72 0.18 145 / 0.12);

/* Error Glow (Tool failure) */
--shadow-glow-error: 0 0 0 1px oklch(0.58 0.22 25 / 0.35),
                     0 0 8px oklch(0.58 0.22 25 / 0.15);

/* Running/Processing Glow (Blue-ish) */
--shadow-glow-info: 0 0 0 1px oklch(0.68 0.17 255 / 0.3),
                    0 0 8px oklch(0.68 0.17 255 / 0.12);
```

---

## 7. Glass Morphism Tokens

Glassmorphism soll subtil eingesetzt werden – hauptsächlich für:
- Chat Header (wenn fixiert)
- Toasts/Notifications
- Floating Panels
- Tool-Call Headers

**NICHT für:** Chat messages, primäre Cards, Buttons (zuviel Glas = unlesbar).

```css
/* ── Glass Tiers ─────────────────────────────────────────── */

/* Glass Ultra-Light (Minimal – z.B. Tooltip Backgrounds) */
.glass-xs {
  background: oklch(0.10 0.012 265 / 0.60);
  backdrop-filter: blur(8px) saturate(1.2);
  border: 1px solid oklch(1 0 0 / 0.05);
}

/* Glass Light (Standard – Chat Header, Toast) */
.glass-sm {
  background: oklch(0.10 0.012 265 / 0.75);
  backdrop-filter: blur(12px) saturate(1.4);
  border: 1px solid oklch(1 0 0 / 0.07);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* Glass Medium (Panels, Sidebars-Overlay) */
.glass-md {
  background: oklch(0.09 0.010 265 / 0.85);
  backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid oklch(1 0 0 / 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* Glass Heavy (Modals, Full Overlay) */
.glass-lg {
  background: oklch(0.08 0.010 265 / 0.92);
  backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid oklch(1 0 0 / 0.06);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}

/* ── CSS Variables ───────────────────────────────────────── */
--glass-blur-sm:  8px;
--glass-blur-md:  12px;
--glass-blur-lg:  16px;
--glass-blur-xl:  24px;

--glass-opacity-subtle:   0.60;
--glass-opacity-light:    0.75;
--glass-opacity-medium:   0.85;
--glass-opacity-strong:   0.92;

--glass-border-subtle:    oklch(1 0 0 / 0.05);
--glass-border-light:     oklch(1 0 0 / 0.07);
--glass-border-medium:    oklch(1 0 0 / 0.08);

/* Cyan-tinted Glass (für Accent-Areas) */
--glass-accent-bg:        oklch(0.12 0.04 185 / 0.65);
--glass-accent-border:    oklch(0.75 0.17 182 / 0.15);
```

---

## 8. Animation Tokens

**Performance-Regel:** Animationen die bei Streaming starten/stoppen könnten sollen `will-change: auto` haben und kurze Laufzeiten (≤ 200ms) bevorzugen.

```typescript
// framer-motion Animation Tokens (für konsistente Verwendung)

export const motionTokens = {
  // ── Durations ──────────────────────────────────────────────
  duration: {
    instant:  0.05,   // 50ms  – Hover states
    fast:     0.15,   // 150ms – Button clicks, Focus rings
    normal:   0.25,   // 250ms – Card appears, Panel slides
    slow:     0.35,   // 350ms – Page transitions, Modals
    deliberate: 0.5,  // 500ms – Special reveals, Emphasis
  },

  // ── Easing Functions ───────────────────────────────────────
  ease: {
    // Standard UI transitions
    out:      [0.0, 0.0, 0.2, 1.0],  // Decelerate (elements entering)
    in:       [0.4, 0.0, 1.0, 1.0],  // Accelerate (elements leaving)
    inOut:    [0.4, 0.0, 0.2, 1.0],  // Both (repositioning)
    
    // Spring (organic feel)
    spring:   { type: "spring", stiffness: 400, damping: 30 },
    springBouncy: { type: "spring", stiffness: 500, damping: 20 },
    springTight: { type: "spring", stiffness: 600, damping: 40 },
    
    // Special
    anticipate: [0.36, 0, 0.66, -0.56],  // Backwards first (playful)
    overshoot:  [0.34, 1.56, 0.64, 1],   // Slight overshoot
  },

  // ── Variant Templates ──────────────────────────────────────
  variants: {
    // Fade + Slide Up (Chat messages, Cards)
    slideUp: {
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] } },
      exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
    },
    
    // Fade + Scale (Toasts, Popovers)
    popIn: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] } },
      exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
    },
    
    // Slide from Right (Toast Notifications)
    slideRight: {
      initial: { opacity: 0, x: 48 },
      animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.0, 0.0, 0.2, 1.0] } },
      exit:    { opacity: 0, x: 48, transition: { duration: 0.2, ease: [0.4, 0.0, 1.0, 1.0] } },
    },
    
    // Expand Height (Collapsible Sections)
    expandHeight: {
      initial: { height: 0, opacity: 0 },
      animate: { height: 'auto', opacity: 1, transition: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] } },
      exit:    { height: 0, opacity: 0, transition: { duration: 0.15 } },
    },
    
    // Skeleton Shimmer (Loading States)
    shimmer: {
      // Verwendet CSS-Animation, nicht Framer Motion (Performance)
      className: 'animate-shimmer',
    },
    
    // Stagger Container (Lists)
    staggerContainer: {
      animate: { transition: { staggerChildren: 0.04 } },
    },
    
    // Stagger Item (für Kinder von staggerContainer)
    staggerItem: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    },
  },

  // ── Micro-Interactions ─────────────────────────────────────
  interactions: {
    // Button Tap
    tapButton: { scale: 0.97 },
    
    // Card Hover Lift
    hoverLift: { y: -2, transition: { duration: 0.15 } },
    
    // Icon Pulse (loading)
    pulse: {
      animate: {
        opacity: [1, 0.5, 1],
        transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
      },
    },
    
    // Spinner
    spin: {
      animate: { rotate: 360 },
      transition: { duration: 1, repeat: Infinity, ease: "linear" },
    },
  },
} as const;
```

### CSS Animation Tokens (für Performance-kritische Loops)

```css
/* Shimmer – für Skeleton Loading (CSS statt JS) */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    var(--muted) 0%,
    oklch(from var(--muted) calc(l + 0.06) c h) 50%,
    var(--muted) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

/* Cursor Blink (Streaming) */
@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Status Pulse (Running Tool Calls) */
@keyframes status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.92); }
}

.animate-status-pulse {
  animation: status-pulse 1.5s ease-in-out infinite;
}

/* Gradient Flow (Active Sidebar Item) */
@keyframes gradient-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

---

## 9. Component Design Tokens Summary

### Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│ LOCAI DESIGN SYSTEM — DARK THEME QUICK REF              │
├──────────────┬──────────────────────────────────────────┤
│ Background   │ oklch(0.08 0.010 265) — Deep blue-black  │
│ Surface      │ oklch(0.11 0.012 265) — Card BG          │
│ Accent/Ring  │ oklch(0.75 0.17  182) — Cyan             │
│ Border       │ oklch(0.22 0.018 265) — Subtle           │
│ Text         │ oklch(0.93 0.008 265) — Near-white       │
│ Muted Text   │ oklch(0.58 0.018 265) — Secondary        │
├──────────────┼──────────────────────────────────────────┤
│ Font         │ Geist Sans / Geist Mono                  │
│ Base Size    │ 15px (0.9375rem)                         │
│ Grid         │ 4px                                      │
├──────────────┼──────────────────────────────────────────┤
│ Radius SM    │ 8px  — Buttons, Inputs                   │
│ Radius MD    │ 12px — Cards, Dialogs                    │
│ Radius LG    │ 16px — Large Cards, Modals               │
├──────────────┼──────────────────────────────────────────┤
│ Anim Fast    │ 150ms — Hover, Focus                     │
│ Anim Normal  │ 250ms — Slide, Fade                      │
│ Anim Slow    │ 350ms — Modal, Page                      │
└──────────────┴──────────────────────────────────────────┘
```

---

## 10. Accessibility

- **Kontrastverhältnis:** Min. 4.5:1 für Text (WCAG AA); Cyan auf Dark BG: ~6.8:1 ✓
- **Focus Rings:** Immer sichtbar, `--ring` = Cyan, 2px Outline + 2px Offset
- **Reduced Motion:** Alle Animationen respektieren `prefers-reduced-motion: reduce`
- **Color-only:** Niemals nur Farbe als einzige Unterscheidung (immer + Icon oder Text)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
