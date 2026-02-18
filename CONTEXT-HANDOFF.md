# CONTEXT-HANDOFF.md

> **Zweck:** Dieses File dient als Übergabe-Dokument zwischen Agent-Sessions.
> Bevor ein Agent out-of-context geht, beschreibt er hier den aktuellen Stand.
> Der nächste Agent liest dieses File zuerst und weiss sofort was zu tun ist.

---

## Letzter Agent
- **Rolle:** 🏗️ Architect Agent (Sprint 5 – ARCH-1 & ARCH-2)
- **Datum:** 2026-02-18
- **Branch:** `sprint5/arch-workflow-engine`
- **Letzte Commits:** "arch: ADR-001 Workflow Engine, ADR-002 RAG Upgrade, workflow-types.ts"

---

## Aktueller Stand

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

---

### Regeln für die Übergabe

1. **VOR dem Ende jeder Session** dieses File updaten
2. **Konkret sein** – keine vagen Beschreibungen wie "fast fertig"
3. **Branch + letzte Commits** angeben
4. **Offene Fragen** explizit markieren – der nächste Agent soll nicht raten müssen
5. **Dateipfade** angeben die geändert/erstellt wurden
6. Wenn ein Task **nicht fertig** wurde: genau beschreiben wo es hängt und was fehlt
