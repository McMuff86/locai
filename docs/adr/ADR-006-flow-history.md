# ADR-006: Flow History

**Status:** Accepted (Implemented)  
**Date:** 2026-02-23  
**Context:** Sprint 6 — Workflow-Runs sollen persistiert und durchsuchbar sein

---

## Decision

### Storage

JSON-Files im Filesystem:

```
~/.locai/flow-history/
├── [flowId]/
│   ├── [runId].json        # Kompletter Run mit allen Steps
│   └── [runId].json
└── index.json              # Lightweight Index für schnelles Listen
```

**Warum Filesystem statt DB:**
- Zero Dependencies (kein SQLite nötig)
- Einfach zu debuggen (JSON lesbar)
- Backup = Ordner kopieren
- Skaliert für lokale Nutzung (100+ Runs kein Problem)

### Run Schema

```typescript
interface FlowHistoryEntry {
  runId: string;
  flowId: string;
  flowName: string;
  startedAt: string;        // ISO timestamp
  completedAt: string;
  status: 'done' | 'failed' | 'cancelled';
  model: string;
  provider: string;
  totalDurationMs: number;
  steps: {
    stepId: string;
    description: string;
    status: 'success' | 'failed';
    durationMs: number;
    toolCalls: { name: string; arguments: unknown }[];
    toolResults: { success: boolean; content: string }[];
    model?: string;         // Per-step model (wenn abweichend)
  }[];
  flowSnapshot?: object;    // Optional: Flow-Definition zum Zeitpunkt des Runs
}
```

### API Routes

| Route | Method | Beschreibung |
|-------|--------|-------------|
| `/api/workflows/[id]/history` | GET | Alle Runs eines Flows |
| `/api/workflows/history/[runId]` | GET | Detail eines Runs |
| `/api/workflows/history/[runId]` | DELETE | Run löschen |

### Auto-Save

In `workflow.ts` → `finalize()`:
- Nach jedem Workflow-Run wird automatisch ein History-Entry gespeichert
- Im `finally`-Block der Workflow-API Route (auch bei Fehlern)
- Best-effort: Fehler beim Speichern brechen den Workflow nicht ab

### Retention

- Max **100 Runs pro Flow** (älteste werden gelöscht)
- Auto-Cleanup: Runs älter als **90 Tage**
- Manuelles Löschen via API

### UI (geplant)

- **Flow Builder:** Bottom Panel mit Run-History des aktuellen Flows
- **History Page:** `/flow/history` mit allen Runs, Filter, Suche
- **Compare Mode:** Zwei Runs nebeneinander (z.B. Modell A vs B)
- **Re-Run:** Button um einen Flow mit gleichen Inputs nochmal auszuführen

---

## Consequences

- Jeder Workflow-Run ist nachvollziehbar (Debugging, Optimierung)
- Modell-Vergleiche möglich (welches Modell für welchen Task?)
- Kein Datenverlust bei Browser-Refresh
- Storage wächst linear — Retention Policy hält es klein
