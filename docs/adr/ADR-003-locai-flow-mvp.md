# ADR-003: LocAI Flow MVP (Visual Workflow Builder)

**Status:** Accepted  
**Datum:** 2026-02-19  
**Autor:** Architect + Coder (Codex Session)  
**Scope:** Visual Workflow Builder (Phase 1 MVP)

---

## Kontext

LocAI hat bereits eine funktionierende Workflow Engine im Chat-Kontext:

- Engine: `src/lib/agents/workflow.ts`
- Types + Stream Events: `src/lib/agents/workflowTypes.ts`
- API: `POST /api/chat/agent/workflow`
- UI: `WorkflowProgress` im Chat

Was fehlt, ist ein visueller Builder, mit dem Workflows als Node-Graph erstellt, konfiguriert, gespeichert und ausgeführt werden können.

Wichtige Ist-Situation:

1. Die Engine führt aktuell linear aus (Step-Index Schleife), nicht als echte DAG-Runtime.
2. `dependsOn` wird im Plan geführt, aber nicht als Scheduling-Logik erzwungen.
3. Für den MVP ist eine stabile, shipping-fähige Integration wichtiger als vollständige n8n-Parität.

---

## Entscheidungen

### 1. Neue Route `/flow` als eigene Surface

Wir bauen den Workflow Builder als eigene App-Route (`src/app/(app)/flow/page.tsx`) statt den bestehenden File-Canvas umzubauen.

Begründung:

- Der File-Canvas ist Window-Management, kein gerichteter Graph-Editor.
- Geringeres Risiko für Regressionen in `documents`.
- Klarere Product Story: Chat = Konversation, Flow = visuelle Pipeline.

### 2. UI Stack für MVP

- `@xyflow/react` für Canvas, Nodes, Edges, Minimap
- `zustand` für lokalen UI-State
- `idb` für lokale Persistenz in IndexedDB

### 3. Runtime-Strategie (MVP)

Der visuelle Graph wird in einen `WorkflowPlan` kompiliert und über die bestehende Workflow-API ausgeführt.

Dafür wird der API-Contract erweitert:

- `WorkflowApiRequest.initialPlan?: WorkflowPlan`

Wenn `initialPlan` gesetzt ist:

- Engine startet mit diesem Plan
- `enablePlanning` wird vom Client für Flow-Runs auf `false` gesetzt
- Ausführung bleibt linear (MVP-Constraint)

### 4. MVP Node-Typen

- `Input`
- `Agent`
- `Template`
- `Output`

MVP garantiert:

- Graph bauen
- Node Config bearbeiten
- Kompilieren (Visual -> WorkflowPlan)
- Ausführen (Run)
- Ergebnis im Output-Node anzeigen
- Save/Load lokal

### 5. Explizite Nicht-Ziele (MVP)

Nicht Bestandteil von Phase 1:

- echte Parallel-Semantik
- If/Else/Loop Runtime
- Compound Nodes
- Ghost Nodes
- Chat<->Flow Auto-Sync
- Multi-Model pro Step-Runtime

### 6. Persistenzmodell (lokal)

Gespeichert wird ein `StoredWorkflow` (Graph + Metadaten + Run-Summaries) in IndexedDB.

Initial nur ein aktiver Workflow (`id = current`), später erweiterbar auf Library.

---

## Technisches Vertragsmodell (MVP)

## Visual -> Plan

- Node `id` -> `WorkflowPlanStep.id`
- Inbound Edges -> `dependsOn[]`
- Agent Tools -> `expectedTools[]`
- Node-spezifischer Text -> `description`
- Node-spezifisches Kriterium -> `successCriteria`

## Execution Event Mapping (UI)

- `step_start` -> Node Status `running`
- `step_end(success)` -> `success`
- `step_end(failed)` oder `error(stepId)` -> `error`
- `message(done=true)` -> Output Node `result`
- `workflow_end` -> Run Summary persistieren

---

## Risiken und Mitigation

### Risiko 1: Plan-Engine-Mismatch bei Control-Flow

Mitigation: Control-Flow Nodes sind explizit Phase 2+, nicht MVP.

### Risiko 2: Nutzer erwartet Dataflow-Semantik wie n8n

Mitigation: MVP kommuniziert klar "Agent Step Chain". Template/Input dienen primär der Step-Formulierung.

### Risiko 3: Stream/Run-Fehler schwer debuggbar

Mitigation: Node Runtime Status + Run Error Anzeige + lokale Run-Summaries.

---

## Akzeptanzkriterien (MVP)

1. Route `/flow` ist über Sidebar erreichbar.
2. User kann mindestens Input -> Agent -> Output bauen und verbinden.
3. `Run` kompiliert den Graphen in einen Plan und startet `/api/chat/agent/workflow`.
4. Step-Status wird live am Node visualisiert.
5. Finale Antwort landet im Output-Node.
6. Workflow wird lokal gespeichert und beim Reload wieder geladen.

