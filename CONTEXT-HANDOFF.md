# CONTEXT-HANDOFF.md

> **Zweck:** Dieses File dient als Übergabe-Dokument zwischen Agent-Sessions.
> Bevor ein Agent out-of-context geht, beschreibt er hier den aktuellen Stand.
> Der nächste Agent liest dieses File zuerst und weiss sofort was zu tun ist.

---

## Letzter Agent
- **Rolle:** 🎨 UI/UX Design Agent
- **Datum:** 2026-02-18
- **Branch:** `sprint5/ui-design-system`
- **Task:** UI-3 – Global Theme & Layout Upgrade Design System

---

## Aktueller Stand

### ✅ Was wurde gemacht

**Neue Dateien erstellt:**

1. **`docs/design/design-system.md`** (20 KB)
   - Vollständige Design-System-Spec für Sprint 5
   - Farbpalette: Zinc/Neutral Base + **Cyan** als Accent (Entscheidung: Cyan über Violet)
   - Typography: **Geist** (bereits installiert, nicht wechseln)
   - Spacing System (4px Grid)
   - Border Radius Convention (xs=4px bis full=9999px)
   - Shadow System (5 Elevation-Level + Glow-Effekte)
   - Glass Morphism Tokens (4 Stufen: xs/sm/md/lg)
   - Animation Tokens (Durations + Easings + Framer Motion Variants)

2. **`docs/design/component-upgrades.md`** (27 KB)
   - Chat Message Bubbles Redesign (User-Bubble: Cyan-tinted gradient; AI-Bubble: Card-surface)
   - Code Block Upgrade (Header mit Filename Tab, Copy-Button State Machine, Run-Button, Language Colors)
   - Toast Redesign (Slide-in von rechts, Progress Bar, Glass-Morphism)
   - Empty States Pattern (generische `<EmptyState>` Component + App-spezifische Presets)
   - Loading Skeleton Shimmer (CSS shimmer statt CSS pulse)
   - Sidebar Collapse Animation (Framer Motion layout animation, Icon-Only-Mode, Shared layoutId)
   - Tool-Call Card Polish (Emoji Map, Status Icon Component, animierter Chevron)

3. **`docs/design/tailwind-tokens.ts`** (18 KB)
   - Alle Design-Tokens als TypeScript-Konstanten (importierbar von Components)
   - CSS Custom Properties für globals.css (Copy-paste ready)
   - Framer Motion Variants als exportierte Konstanten
   - Utility- und Component-Klassen für globals.css `@layer`
   - `langColorMap`, `toolEmoji`, `radius`, `shadows` Maps

**Branch:** `sprint5/ui-design-system` (von `main` erstellt, committed + gepusht)

---

## Was als nächstes zu tun ist
- —

### Sofort (Coder-Agent):

1. **globals.css aktualisieren** (Quick Win #1)
   - Ersetze `.dark { ... }` Block mit den verfeinerten Werten aus `docs/design/tailwind-tokens.ts` (Export `darkModeVariables`)
   - Füge neue Keyframes hinzu: `shimmer`, `status-pulse`, `gradient-flow`
   - Füge `@layer utilities { ... }` Block hinzu aus `utilityClasses`-Export
   - Füge `@layer components { ... }` Block hinzu aus `componentClasses`-Export

2. **Skeleton Shimmer** (Quick Win #2, 30 Min)
   - `src/components/ui/skeleton.tsx`: Ersetze `animate-pulse` durch `animate-shimmer`
   - Skeleton-Klassen in `MessageSkeleton` verbessern (siehe `component-upgrades.md` Abschnitt 5)

3. **Chat Message Bubbles** (1-2h)
   - `src/components/chat/ChatMessage.tsx` Card-Klassen updaten
   - User: `.chat-bubble-user` Klasse, AI: `.chat-bubble-ai` Klasse
   - Animation-Variant von `{ y: 20 }` zu `{ y: 12, scale: 0.98 }` verfeinern
   - Header-Row: Timestamp mit `font-mono` und `text-[11px]`

4. **Toast Redesign** (1-2h)
   - `src/components/ui/toast.tsx` und `toaster.tsx` erweitern
   - Progress Bar via Framer Motion hinzufügen
   - Glass-Morphism Klassen anwenden
   - `slideRight` Variant für AnimatePresence

5. **Code Block** (2-3h)
   - `src/components/chat/MarkdownRenderer.tsx` prüfen wo CodeBlocks gerendert werden
   - Neue `<CodeBlock>` Komponente erstellen in `src/components/chat/CodeBlock.tsx`
   - CopyButton State Machine implementieren
   - Run-Button für python/javascript/bash

6. **Sidebar Collapse** (2-3h)
   - `src/app/(app)/layout.tsx` mit Framer Motion `layout` Animation ausstatten
   - `useState` für `collapsed: boolean` hinzufügen
   - `localStorage` persistieren: `locai-sidebar-collapsed`
   - NavItem mit Tooltip im collapsed state

7. **Empty States** (1h)
   - Neue `<EmptyState>` Komponente erstellen in `src/components/ui/empty-state.tsx`
   - In `ChatContainer`, `Gallery/EmptyState`, `NotesList`, `DocumentManager` einsetzen

8. **Tool-Call Cards** (30 Min)
   - `src/components/chat/ToolCallBlock.tsx`: Emoji Map + Status Icon Component einbauen
   - Chevron-Rotation Animation (Framer Motion `animate={{ rotate: isExpanded ? 90 : 0 }}`)
   - Border-Klassen auf `.tool-card-*` Klassen upgraden

### Später (Nice-to-have):
- Hover Preview in Konversations-Sidebar
- Keyboard Navigation (↑↓) in Conversation List
- Smooth Scroll-to-Bottom Button
- Typing Indicator Animation

---

## Offene Fragen / Blocker

1. **`MarkdownRenderer.tsx` ungelesen** — Muss der Coder prüfen wie CodeBlocks aktuell gerendert werden (react-syntax-highlighter direkt oder wrapper?). Der Upgrade-Plan in `component-upgrades.md` geht von einer neuen `<CodeBlock>` Wrapper-Komponente aus.

2. **Toast-System:** Aktuell Shadcn's `useToast` Hook. Der Redesign erfordert Anpassung von `toast.tsx` UND `toaster.tsx`. Shadcn Toast ist radix-basiert — Progress Bar muss als Slot eingefügt werden, nicht als separates Portal.

3. **Sidebar localStorage:** Entscheidung nötig: Soll der Collapse-Zustand persistent sein (localStorage)? Empfehlung: **Ja**, mit Key `locai:sidebar-collapsed`.

4. **Tailwind v4 Kompatibilität:** Alle Utility-Klassen in `tailwind-tokens.ts` sind für Tailwind v4 + CSS Custom Properties geschrieben. Falls etwas nicht funktioniert, liegt es daran dass Tailwind v4 manche `@apply`-Direktiven anders handhabt als v3. Ggf. direkte CSS schreiben.

---

## Wichtige Dateien / Entscheidungen

| Datei | Zweck | Status |
|-------|-------|--------|
| `docs/design/design-system.md` | Haupt-Spec | ✅ Fertig |
| `docs/design/component-upgrades.md` | Component-by-Component Specs | ✅ Fertig |
| `docs/design/tailwind-tokens.ts` | Copy-paste CSS/TS Tokens | ✅ Fertig |
| `src/app/globals.css` | Aktuelles Theme | ⚠️ Muss implementiert werden |
| `src/components/ui/skeleton.tsx` | Skeleton Component | ⚠️ Shimmer-Upgrade ausstehend |
| `src/components/chat/ChatMessage.tsx` | Chat Bubbles | ⚠️ Redesign ausstehend |
| `src/components/chat/ToolCallBlock.tsx` | Tool Call Cards | ⚠️ Polish ausstehend |
| `src/app/(app)/layout.tsx` | Sidebar | ⚠️ Collapse-Animation ausstehend |

### Key Design Decisions

- **Accent Farbe: Cyan** (oklch(0.75 0.17 182)) — konsistent mit bestehendem Theme
- **Font: Geist** — bereits installiert, kein Wechsel zu Inter
- **Dark-first:** Alle Specs sind primär für Dark Mode geschrieben
- **Performance:** Animationen ≤ 250ms, Shimmer via CSS (nicht JS), keine JS-Loops während Streaming
- **Shadcn/UI:** Extend, not replace — alle neuen Klassen sind Additions

---

### Regeln für die Übergabe

1. **VOR dem Ende jeder Session** dieses File updaten
2. **Konkret sein** – keine vagen Beschreibungen wie "fast fertig"
3. **Branch + letzte Commits** angeben
4. **Offene Fragen** explizit markieren – der nächste Agent soll nicht raten müssen
5. **Dateipfade** angeben die geändert/erstellt wurden
6. Wenn ein Task **nicht fertig** wurde: genau beschreiben wo es hängt und was fehlt
