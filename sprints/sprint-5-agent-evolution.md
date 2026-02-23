# Sprint 5 – Agent Evolution & Premium Polish

**Zeitraum:** 18.02 – 28.02.2026
**Ziel:** LocAI Agent Mode zum vollwertigen lokalen AI-Assistenten ausbauen + UI Premium-Polish

---

## Sync-Status (Abgleich mit 100 Commits)

- **Abgleich durchgeführt:** 23.02.2026 (letzte 100 Commits, `33eb336` bis `37e3d0d`)
- **Letzte Sprint-relevante Merges:**  
  `348b0d4` (RAG Improvements), `d0fcd37` (UI Polish Final), `98ddb48` (Workflow DI + Tests), `2add957` (Workflow Tests)
- **Wichtigster aktueller Blocker:** Fehlende Testabdeckung für Integration (Multi-Step File Operation) und Workflow-UI Snapshots.

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
- [x] Architektur für Multi-Step Workflows definieren *(ADR-001, PR #16)*
  - Agent plant → führt Schritte aus → reflektiert → next step
  - Workflow-State-Machine (idle → planning → executing → reflecting → done)
  - Max iterations, timeout, cancellation
- [x] API-Contract für Workflow-Streaming definieren *(ADR-001)*
- [x] Entscheidung: Workflow-Persistenz (Resume nach Browser-Refresh?) *(PR #48 — persistence + resume + REST cancel)*

### FEAT-1: Agent Workflow Implementation (Coder)
- [x] Workflow-Engine in `lib/agents/workflow.ts` *(PR #18)*
- [x] Planning-Step verbessern (strukturierter Plan mit Schritten) *(PR #18)*
- [x] Reflection-Step nach Tool-Ausführung (Agent bewertet eigenes Ergebnis) *(PR #18)*
- [x] Workflow-History (welche Steps wurden ausgeführt, mit Ergebnis) *(PR #18)*
- [x] Agent kann eigenen Plan anpassen basierend auf Zwischenergebnis *(PR #18)*

### UI-1: Workflow Visualization (UI/UX)
- [x] Step-by-Step Progress Indicator *(PR #18)*
- [x] Collapsible Workflow Timeline *(PR #18)*
- [x] Tool-Call Cards mit Status-Icons (⏳ running, ✅ done, ❌ failed) *(PR #33)*
- [x] Smooth Animationen für neue Steps (Framer Motion) *(PR #18)*

### TEST-1: Workflow Tests (Tester)
- [x] Unit Tests für Workflow State Machine *(19f2f01, a3096d7, 2add957, 98ddb48)*
- [ ] Integration Test: Multi-Step File Operation
- [x] Edge Cases: Timeout, Cancel mid-workflow, Tool-Fehler Recovery *(workflowEdgeCases.test.ts; 2 Tests aktuell `skip`)*
- [ ] Snapshot Tests für Workflow UI Components

---

## 🟡 Prio 2: RAG Upgrade

### ARCH-2: RAG Architecture Review (Architect)
- [x] Chunk-Strategie überdenken (500 chars → semantic chunking?) *(ADR-002)*
- [x] Hybrid Search: BM25 + Cosine Similarity *(ADR-002)*
- [x] Re-Ranking Strategy (Cross-Encoder lokal?) *(ADR-002)*
- [x] Context Window Management (wie viel RAG-Context pro Query?) *(ADR-002)*

### FEAT-2: RAG Improvements (Coder)
- [x] Drag & Drop Upload (Dateien in Chat-Area droppen) *(`onDocumentUpload` in `chat/page.tsx` verdrahtet; 23.02.2026)*
- [x] Multi-File Upload mit Progress *(DocumentUpload + Queue/Progress UI; 348b0d4)*
- [ ] Bessere Chunk-Vorschau in Document Details
- [x] Chat-Context: zeige welche RAG-Chunks genutzt wurden (Quellen-Anzeige) *(SourceCitation + `ragSources`; 348b0d4)*
- [x] Auto-Index: neue Files im Workspace automatisch embedden *(WorkspaceIndexer + `/api/documents/workspace`; 348b0d4)*

### UI-2: RAG UI Polish (UI/UX)
- [x] Upload-Animation (Drag-Over Glow Effect) *(DocumentUpload/ChatInput)*
- [x] Source Citations in Chat-Messages (collapsible) *(SourceCitation.tsx)*
- [x] Document Cards Redesign (Thumbnail, Status Badge, Chunk Count) *(b1abe09 + 348b0d4)*

---

## 🟡 Prio 3: Premium UI Polish

### UI-3: Global Theme & Layout Upgrade (UI/UX)
- [x] **Typography Upgrade:** Inter/Geist Font, bessere Hierarchie *(Design System Spec v1.0, PR #17)*
- [x] **Color System:** Konsistentes Zinc/Neutral + Accent Color (Cyan oder Violet) *(PR #17, PR #21)*
- [x] **Spacing & Rhythm:** 4px Grid System durchziehen *(PR #17)*
- [x] **Glass Morphism:** Subtle blur-Effekte auf Panels/Dialogs *(PR #23)*
- [x] **Micro-Interactions:** Button hover states, focus rings, transitions *(PR #35)*
- [x] **Loading States:** Skeleton Shimmer Upgrade (statt einfacher Pulse) *(d0fcd37)*
- [x] **Empty States:** Illustrationen/Icons statt nur Text *(d0fcd37)*
- [x] **Toast Redesign:** Slide-in von rechts mit Progress-Bar *(d0fcd37)*

### UI-4: Chat Experience (UI/UX)
- [x] Message-Bubbles Redesign (subtle shadows, better spacing) *(PR #22, #23)*
- [x] Code-Block Upgrade (Filename Tab, Copy + Run Buttons) *(PR #23)*
- [x] Typing Indicator Animation *(TypingIndicator + ChatContainer; d0fcd37)*
- [x] Smooth Scroll-to-Bottom mit Button *(ScrollToBottom + ChatContainer; d0fcd37)*
- [x] Agent Tool-Calls: Card-Design mit Expand/Collapse *(PR #33)*

### UI-5: Navigation & Sidebar (UI/UX)
- [x] Sidebar Collapse Animation (nicht abrupt) *(PR #23)*
- [x] Active Route Indicator (Glow/Underline) *(PR #22)*
- [x] Conversation List: Hover Preview (erste Zeile) *(ConversationPreview + ConversationList; d0fcd37)*
- [x] Keyboard Navigation (↑↓ durch Conversations) *(useKeyboardNavigation + ConversationList; d0fcd37)*

---

## 🟢 Prio 4: FileBrowser Ausbau

### FEAT-3: FileBrowser Features (Coder)
- [x] File Create/Edit direkt im Browser *(Canvas Editor PR #25, #26)*
- [x] Rename (Route existiert schon) *(PR #56)*
- [x] Move/Copy (Route existiert schon) *(PR #56)*
- [x] Multi-Select + Batch Operations *(PR #57 — resizable sidebar, action menu)*
- [ ] "Open in Chat" Button (File als Context in Chat laden)

---

## 🟢 Prio 5: Developer Experience

### DOCS-1: Dokumentation (Docs Agent)
- [x] CLAUDE.md aktualisieren mit Sprint 5 Changes *(PR #15, mehrere Updates)*
- [x] CONTEXT-HANDOFF.md Pattern dokumentieren *(PR #14)*
- [x] API-Docs: OpenAPI/Swagger Spec für alle Routes *(docs/API.md + docs/openapi.yaml — 2619 Zeilen!)*
- [x] Inline Code Comments: komplexe Logik in executor.ts, workflow.ts *(mehrere Refactors/Kommentierungen, u.a. 98ddb48/05db537)*
- [x] Architecture Decision Records (ADRs) für Workflow Engine + RAG Strategy *(ADR-001 + ADR-002, PR #16)*
- [x] README.md erstellen (aktuell fehlt eine!) *(PR #15)*

---

## Definition of Done

- [ ] Alle Tests grün (`npm run preflight`)
- [ ] CONTEXT-HANDOFF.md aktuell
- [x] CLAUDE.md aktualisiert
- [x] Keine TypeScript Errors
- [ ] UI responsive (Desktop + Tablet)
- [ ] Dark + Light Theme funktioniert

---

## Offene Restarbeit (Sprint 5)

1. Fehlende Tests: Integrationstest für Multi-Step File Operation + UI Snapshot Tests.
2. Optional: Chunk-Vorschau in Document Details über `chunkCount` hinaus ausbauen.
