# Sprint 5 – Agent Evolution & Premium Polish

**Zeitraum:** 18.02 – 28.02.2026
**Ziel:** LocAI Agent Mode zum vollwertigen lokalen AI-Assistenten ausbauen + UI Premium-Polish

---

## Agent-Rollen

| Agent | Aufgabe | Branch-Prefix |
|-------|---------|---------------|
| 🏗️ **Architect** | Architektur-Entscheidungen, API-Design, Datenfluss | `sprint5/arch-*` |
| 💻 **Coder** | Feature-Implementierung, Bug-Fixes | `sprint5/feat-*` |
| 🧪 **Tester** | Tests schreiben, Edge Cases, Integration Tests | `sprint5/test-*` |
| 🎨 **UI/UX Designer** | Premium Polish, Animationen, Dark Theme Upgrade | `sprint5/ui-*` |
| 📝 **Docs** | CLAUDE.md, API Docs, Inline Comments, CONTEXT-HANDOFF | `sprint5/docs-*` |

### Workflow
1. **Architect** definiert Architektur + API-Contracts zuerst
2. **Coder** implementiert nach Architect-Spec
3. **UI/UX** arbeitet parallel an Polish + neue Components
4. **Tester** schreibt Tests während/nach Coder
5. **Docs** dokumentiert laufend + pflegt CONTEXT-HANDOFF.md
6. Jeder Agent **updated CONTEXT-HANDOFF.md** bevor er endet

---

## 🔴 Prio 1: Multi-Step Agent Workflows

### ARCH-1: Agent Workflow Engine (Architect)
- [ ] Architektur für Multi-Step Workflows definieren
  - Agent plant → führt Schritte aus → reflektiert → next step
  - Workflow-State-Machine (idle → planning → executing → reflecting → done)
  - Max iterations, timeout, cancellation
- [ ] API-Contract für Workflow-Streaming definieren
- [ ] Entscheidung: Workflow-Persistenz (Resume nach Browser-Refresh?)

### FEAT-1: Agent Workflow Implementation (Coder)
- [ ] Workflow-Engine in `lib/agents/workflow.ts`
- [ ] Planning-Step verbessern (strukturierter Plan mit Schritten)
- [ ] Reflection-Step nach Tool-Ausführung (Agent bewertet eigenes Ergebnis)
- [ ] Workflow-History (welche Steps wurden ausgeführt, mit Ergebnis)
- [ ] Agent kann eigenen Plan anpassen basierend auf Zwischenergebnis

### UI-1: Workflow Visualization (UI/UX)
- [ ] Step-by-Step Progress Indicator
- [ ] Collapsible Workflow Timeline
- [ ] Tool-Call Cards mit Status-Icons (⏳ running, ✅ done, ❌ failed)
- [ ] Smooth Animationen für neue Steps (Framer Motion)

### TEST-1: Workflow Tests (Tester)
- [ ] Unit Tests für Workflow State Machine
- [ ] Integration Test: Multi-Step File Operation
- [ ] Edge Cases: Timeout, Cancel mid-workflow, Tool-Fehler Recovery
- [ ] Snapshot Tests für Workflow UI Components

---

## 🟡 Prio 2: RAG Upgrade

### ARCH-2: RAG Architecture Review (Architect)
- [ ] Chunk-Strategie überdenken (500 chars → semantic chunking?)
- [ ] Hybrid Search: BM25 + Cosine Similarity
- [ ] Re-Ranking Strategy (Cross-Encoder lokal?)
- [ ] Context Window Management (wie viel RAG-Context pro Query?)

### FEAT-2: RAG Improvements (Coder)
- [ ] Drag & Drop Upload (Dateien in Chat-Area droppen)
- [ ] Multi-File Upload mit Progress
- [ ] Bessere Chunk-Vorschau in Document Details
- [ ] Chat-Context: zeige welche RAG-Chunks genutzt wurden (Quellen-Anzeige)
- [ ] Auto-Index: neue Files im Workspace automatisch embedden

### UI-2: RAG UI Polish (UI/UX)
- [ ] Upload-Animation (Drag-Over Glow Effect)
- [ ] Source Citations in Chat-Messages (collapsible)
- [ ] Document Cards Redesign (Thumbnail, Status Badge, Chunk Count)

---

## 🟡 Prio 3: Premium UI Polish

### UI-3: Global Theme & Layout Upgrade (UI/UX)
- [ ] **Typography Upgrade:** Inter/Geist Font, bessere Hierarchie
- [ ] **Color System:** Konsistentes Zinc/Neutral + Accent Color (Cyan oder Violet)
- [ ] **Spacing & Rhythm:** 4px Grid System durchziehen
- [ ] **Glass Morphism:** Subtle blur-Effekte auf Panels/Dialogs
- [ ] **Micro-Interactions:** Button hover states, focus rings, transitions
- [ ] **Loading States:** Skeleton Shimmer Upgrade (statt einfacher Pulse)
- [ ] **Empty States:** Illustrationen/Icons statt nur Text
- [ ] **Toast Redesign:** Slide-in von rechts mit Progress-Bar

### UI-4: Chat Experience (UI/UX)
- [ ] Message-Bubbles Redesign (subtle shadows, better spacing)
- [ ] Code-Block Upgrade (Filename Tab, Copy + Run Buttons)
- [ ] Typing Indicator Animation
- [ ] Smooth Scroll-to-Bottom mit Button
- [ ] Agent Tool-Calls: Card-Design mit Expand/Collapse

### UI-5: Navigation & Sidebar (UI/UX)
- [ ] Sidebar Collapse Animation (nicht abrupt)
- [ ] Active Route Indicator (Glow/Underline)
- [ ] Conversation List: Hover Preview (erste Zeile)
- [ ] Keyboard Navigation (↑↓ durch Conversations)

---

## 🟢 Prio 4: FileBrowser Ausbau

### FEAT-3: FileBrowser Features (Coder)
- [ ] File Create/Edit direkt im Browser
- [ ] Rename (Route existiert schon)
- [ ] Move/Copy (Route existiert schon)
- [ ] Multi-Select + Batch Operations
- [ ] "Open in Chat" Button (File als Context in Chat laden)

---

## 🟢 Prio 5: Developer Experience

### DOCS-1: Dokumentation (Docs Agent)
- [ ] CLAUDE.md aktualisieren mit Sprint 5 Changes
- [ ] CONTEXT-HANDOFF.md Pattern dokumentieren
- [ ] API-Docs: OpenAPI/Swagger Spec für alle Routes
- [ ] Inline Code Comments: komplexe Logik in executor.ts, workflow.ts
- [ ] Architecture Decision Records (ADRs) für Workflow Engine + RAG Strategy
- [ ] README.md erstellen (aktuell fehlt eine!)

---

## Definition of Done

- [ ] Alle Tests grün (`npm run preflight`)
- [ ] CONTEXT-HANDOFF.md aktuell
- [ ] CLAUDE.md aktualisiert
- [ ] Keine TypeScript Errors
- [ ] UI responsive (Desktop + Tablet)
- [ ] Dark + Light Theme funktioniert
