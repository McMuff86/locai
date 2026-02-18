# CONTEXT-HANDOFF.md

> **Zweck:** Übergabe-Dokument zwischen Agent-Sessions.
> Bevor ein Agent out-of-context geht, beschreibt er hier den aktuellen Stand.
> Der nächste Agent liest dieses File zuerst.

---

## Letzter Agent
- **Rolle:** Orchestrator (Sentinel)
- **Datum:** 18.02.2026
- **Branch:** main

## Aktueller Stand

Sprint 5 Foundation komplett. Alle PRs gemerged in main:
- ✅ #15 Docs (README, CONTRIBUTING)
- ✅ #16 Architecture (ADR-001 Workflow, ADR-002 RAG)
- ✅ #17 Design System (Cyan, Geist, Component Specs)
- ✅ #18 Workflow Engine (Code)
- ✅ #19 Tests (138 neue, 238 total)

## Was als nächstes zu tun ist
- UI Cleanup: SetupCard vereinfachen, Design System einbauen
- Default: Agent Mode statt Standard-Assistent
- Design System Tokens in globals.css + Components umsetzen
- RAG Upgrade (FEAT-2) implementieren nach ADR-002

## Wichtige Dateien
- `docs/design/design-system.md` – Design Tokens
- `docs/design/component-upgrades.md` – Component Specs
- `docs/design/tailwind-tokens.ts` – CSS Variables + TS Constants
- `docs/adr/ADR-001-workflow-engine.md` – Workflow Architektur
- `docs/adr/ADR-002-rag-upgrade.md` – RAG Architektur
- `src/lib/agents/workflow.ts` – Workflow Engine
- `src/components/chat/WorkflowProgress.tsx` – Workflow UI

---

### Regeln für die Übergabe

1. **VOR dem Ende jeder Session** dieses File updaten
2. **Konkret sein** – keine vagen Beschreibungen
3. **Branch + letzte Commits** angeben
4. **Offene Fragen** explizit markieren
5. **Dateipfade** angeben die geändert/erstellt wurden
