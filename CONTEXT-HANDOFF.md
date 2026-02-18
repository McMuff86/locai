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
- **Rolle:** 🏗️ Architect Agent (Sprint 5 – ARCH-1 & ARCH-2)
- **Datum:** 2026-02-18
- **Branch:** `sprint5/arch-workflow-engine`
- **Letzte Commits:** "arch: ADR-001 Workflow Engine, ADR-002 RAG Upgrade, workflow-types.ts"

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

Sprint 5 Architektur-Phase **abgeschlossen**. Alle Architect-Deliverables sind committed und gepusht.

**Erledigte Tasks:**
- ✅ ARCH-1: Agent Workflow Engine Architektur
- ✅ ARCH-2: RAG Architecture Review

**Nächste Phase:** Coder Agent implementiert FEAT-1 (Workflow Engine) und FEAT-2 (RAG Improvements).

---

## Was wurde gemacht

### Neue Dateien (alle in `docs/adr/`)

| Datei | Inhalt |
|-------|--------|
| `docs/adr/ADR-001-workflow-engine.md` | Multi-Step Workflow Engine Design, State Machine, Persistenz-Entscheidung, API-Contract, Limits |
| `docs/adr/ADR-002-rag-upgrade.md` | Chunk-Strategie, Hybrid Search (BM25+Cosine), Context Window Management, Source Citations |
| `docs/adr/workflow-types.ts` | Vollständige TypeScript Interfaces für Workflow Engine |

### Entscheidungen getroffen

1. **Workflow Engine als Layer** über `executeAgentLoop()` – nicht als Ersatz
2. **State Machine:** idle → planning → executing → reflecting → done (mit Branching)
3. **Persistenz:** IndexedDB (Browser) + `~/.locai/workflows/` (Server) – Hybrid-Ansatz
4. **Neuer Endpoint:** `POST /api/chat/agent/workflow` (bestehend `/api/chat/agent` bleibt kompatibel)
5. **Chunk-Größe:** 500 → 800–1200 Chars + Sentence-Boundary-Snapping
6. **Hybrid Search:** BM25 (0.3 Gewicht) + Cosine Similarity (0.7 Gewicht)
7. **Re-Ranking:** Cross-Encoder → Phase 3 (zu komplex für Sprint 5)

---

## Was als nächstes zu tun ist

### 🔴 Coder Agent – FEAT-1: Workflow Engine (Prio 1)

**Branch erstellen:** `sprint5/feat-workflow-engine` (von `sprint5/arch-workflow-engine` ODER von `main`)

**Reihenfolge wichtig:**

1. `src/lib/agents/workflow.ts` – WorkflowEngine Klasse bauen
   - State Machine implementieren (States aus `docs/adr/workflow-types.ts`)
   - `WorkflowEngine.start()` → AsyncGenerator mit WorkflowStreamEvents
   - `WorkflowEngine.cancel()` → AbortController
   - Intern: `executeAgentLoop()` pro Step aufrufen
   - Reflection Phase: Separater LLM-Call nach jedem Step

2. `src/lib/agents/workflowPlanner.ts` – Strukturierter Planner
   - LLM-Aufruf mit JSON-Plan-Prompt
   - JSON-Parsing mit Fallback auf Text-Plan
   - Plan-Validierung (max 8 Steps, valide Tool-Namen)

3. `src/app/api/chat/agent/workflow/route.ts` – Neuer API Endpoint
   - WorkflowApiRequest validieren
   - WorkflowEngine instanziieren
   - NDJSON-Stream mit `WorkflowStreamEvent[]` senden

4. `src/hooks/useAgentChat.ts` – Hook erweitern
   - Neue State-Felder für Workflow (workflowState, workflowPlan, workflowSteps)
   - `sendWorkflowMessage()` Funktion für neuen Endpoint
   - `workflowMode` Toggle

5. `src/lib/agents/workflowStore.ts` – IndexedDB Persistenz (kann nach UI kommen)
   - DB-Schema: `docs/adr/workflow-types.ts` → `WorkflowIndexedDBRecord`
   - Auto-Save nach jedem Step
   - Resume-Logic beim Page-Load

### 🟡 Coder Agent – FEAT-2: RAG Improvements (Prio 2)

**Branch:** `sprint5/feat-rag-improvements`

1. `src/lib/documents/constants.ts` → Chunk-Sizes erhöhen (Werte aus ADR-002)
2. `src/lib/documents/chunker.ts` → `snapToSentenceBoundary()` Helper
3. `src/lib/documents/bm25.ts` → BM25 Klasse (pure TypeScript, keine Dependencies)
4. `src/lib/documents/rag.ts` → `searchDocuments()` auf Hybrid-Score umstellen
5. `src/lib/documents/contextManager.ts` → Dynamisches Context Budget
6. `src/lib/documents/rag.ts` → Source Citations Format in `injectRAGContext()`

### 🎨 UI/UX Agent – UI-1: Workflow Visualization (parallel zu FEAT-1 möglich)

**Branch:** `sprint5/ui-workflow-viz`

Kann starten sobald `workflow-types.ts` und FEAT-1 Step 4 (Hook) fertig ist.

- `src/components/chat/WorkflowTimeline.tsx` – Step-by-Step Progress
- `src/components/chat/WorkflowStepCard.tsx` – Einzelner Step mit Status-Icon
- `src/components/chat/WorkflowPlanView.tsx` – Collapsible Plan-Anzeige

---

## Offene Fragen / Entscheidungen für Adi

1. **Reflection standardmäßig an oder aus?** ADR empfiehlt: an. Erhöht aber Latenz um ~1-2s pro Step. Wenn Adi Latenz bevorzugt: off by default, als Toggle.

2. **Workflow-Mode als separater Toggle oder immer aktiv?** Empfehlung: Separater Toggle neben "Agent Mode". Oder: Workflow Mode = "Enhanced Agent Mode" ersetzt Agent Mode komplett.

3. **Re-Index Button in der UI?** Wenn Chunk-Sizes geändert werden, müssen Dokumente neu indiziert werden. Braucht UI-Button in Document Manager. Ist Coder- oder UI/UX-Task?

4. **BM25 Weight (0.3/0.7)?** Kann als Settings-Option exponiert werden. Empfehlung: Fix 0.3/0.7 für Sprint 5, Settings in Sprint 6.

---

## Wichtige Dateien / Entscheidungen

### Neue Dateien (Architect)
- `docs/adr/ADR-001-workflow-engine.md` – Primäre Architektur-Referenz für FEAT-1
- `docs/adr/ADR-002-rag-upgrade.md` – Primäre Referenz für FEAT-2
- `docs/adr/workflow-types.ts` – **WICHTIG:** Coder Agent MUSS diese Interfaces implementieren

### Bestehende Dateien die geändert werden (Coder)
- `src/lib/agents/types.ts` – Um Workflow-Types erweitern (oder separate Datei)
- `src/lib/agents/executor.ts` – **NICHT ändern** – nur von außen aufrufen
- `src/hooks/useAgentChat.ts` – Workflow-State hinzufügen
- `src/lib/documents/constants.ts` – Chunk-Sizes
- `src/lib/documents/rag.ts` – Hybrid Search
- `src/lib/documents/chunker.ts` – Sentence Boundary

### Kritische Constraints
- **Ollama lokal** – kein Cloud-API, kein external Inference
- **executor.ts nicht ersetzen** – nur erweitern
- **Rückwärtskompatibilität:** `/api/chat/agent` muss weiter funktionieren
- **TypeScript strict** – keine `any` ohne Kommentar
- **Rolle:** 📝 Docs Agent
- **Datum:** 2026-02-18
- **Branch:** `sprint5/docs-readme`
- **Letzte Commits:** `docs: add README, CONTRIBUTING, deprecate Agents.md`

## Aktueller Stand

DOCS-1 (Sprint 5, Prio 5) ist **vollständig abgeschlossen**.

Die Branch `sprint5/docs-readme` wurde von `main` erstellt, alle Files committed und gepusht.

## Was wurde gemacht

### Neue Dateien erstellt:

- **`README.md`** — Vollständige GitHub-optimierte Projektdokumentation für externe Besucher:
  - Badges (Next.js, React, TypeScript, Ollama, License)
  - Feature-Tabelle mit Emojis
  - Quick Start mit Prerequisites (Node 22+, Ollama, optional SearXNG + ComfyUI)
  - Ollama model recommendations (qwen2.5, nomic-embed-text)
  - Dev Setup + alle npm scripts dokumentiert
  - Environment Variables Tabelle
  - Agent Mode Section mit Tool-Übersicht und Model-Kompatibilität
  - Tech Stack Tabelle mit Versionen und Links
  - Keyboard Shortcuts Tabelle
  - Data Storage Overview (`~/.locai/` Struktur)

- **`CONTRIBUTING.md`** — Vollständige Contributor-Dokumentation:
  - Branch Convention (`sprint5/<role>-<feature>`) mit Beispielen
  - Commit Message Format mit Typen und Beispielen
  - PR Process (Branch Protection, preflight requirement)
  - CONTEXT-HANDOFF.md Workflow erklärt
  - Agent-Rollen Tabelle
  - Code Style: TypeScript strict, React/Next.js Patterns, Tailwind, Shadcn
  - Test Requirements mit `npm run preflight`
  - Security Notes (path traversal, local-only mutations)

### Geänderte Dateien:

- **`Agents.md`** — Als deprecated markiert mit klaren Verweisen auf:
  - `CLAUDE.md` (für AI Agents)
  - `README.md` + `CONTRIBUTING.md` (für menschliche Contributors)
  - `CONTEXT-HANDOFF.md` (für Handoff-State)

- **`CONTEXT-HANDOFF.md`** — Dieses File (wird bei Push aktualisiert)

## Was als nächstes zu tun ist

### DOCS-1 Followup (nice to have):
- [ ] Screenshots für README.md erstellen (aktuell TODO Placeholder)
- [ ] OpenAPI/Swagger Spec für alle API Routes (wurde in Sprint 5 Backlog erwähnt aber nicht in DOCS-1 gefordert)
- [ ] ADRs (Architecture Decision Records) für Workflow Engine + RAG Strategy

### Nächste Sprint-Tasks (nach Prio):
- [ ] **ARCH-1** — Workflow Engine Architektur (höchste Prio im Sprint)
- [ ] **FEAT-1** — Workflow Engine Implementation
- [ ] **UI-1** — Workflow Visualization

### Offene Fragen für Architect:
- Workflow-Persistenz: Sollen Workflows nach Browser-Refresh fortsetzbar sein?
- Soll ein neuer Agent-Loop mit Reflection Step den alten `executor.ts` ersetzen oder erweitern?

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
- Keine Blocker für Docs
- Screenshot-Placeholder in README.md muss noch gefüllt werden (braucht laufende App + Screen capture)

## Wichtige Dateien / Entscheidungen

| Datei | Zweck |
|-------|-------|
| `README.md` | Externe Projektdokumentation (GitHub) |
| `CONTRIBUTING.md` | Contributor Guide + Agent Workflow |
| `Agents.md` | Deprecated — verweist auf CLAUDE.md |
| `CLAUDE.md` | Autoritative AI-Agent Dokumentation |
| `sprints/sprint-5-agent-evolution.md` | Sprint Backlog |

**Entscheidung:** Agents.md wurde deprecated (nicht gelöscht), damit bestehende Links/Referenzen weiterhin funktionieren.

---

### Regeln für die Übergabe

1. **VOR dem Ende jeder Session** dieses File updaten
2. **Konkret sein** – keine vagen Beschreibungen wie "fast fertig"
3. **Branch + letzte Commits** angeben
4. **Offene Fragen** explizit markieren – der nächste Agent soll nicht raten müssen
5. **Dateipfade** angeben die geändert/erstellt wurden
6. Wenn ein Task **nicht fertig** wurde: genau beschreiben wo es hängt und was fehlt
