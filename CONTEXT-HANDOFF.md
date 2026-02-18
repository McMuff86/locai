# CONTEXT-HANDOFF.md

> **Zweck:** Dieses File dient als Übergabe-Dokument zwischen Agent-Sessions.
> Bevor ein Agent out-of-context geht, beschreibt er hier den aktuellen Stand.
> Der nächste Agent liest dieses File zuerst und weiss sofort was zu tun ist.

---

## Letzter Agent
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

## Offene Fragen / Blocker
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
