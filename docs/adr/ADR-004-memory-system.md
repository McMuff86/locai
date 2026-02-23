# ADR-004: Memory System

**Status:** Accepted  
**Date:** 2026-02-23  
**Context:** Sprint 6 — LocAI braucht ein Langzeitgedächtnis für Agents und User-Kontext

---

## Decision

### Memory-Typen

| Typ | Beschreibung | Beispiel |
|-----|-------------|---------|
| `conversation` | Chat-Interaktionen, Fragen/Antworten | "User fragte nach SIA-Normen" |
| `agent` / `workflow_result` | Workflow-Ergebnisse + Learnings | "PDF-Zusammenfassung: 12 Seiten, 130s mit qwen3" |
| `preference` | User-Präferenzen, Einstellungen | "Bevorzugt Deutsch, arbeitet mit Baunormen" |

### Storage: Markdown-First + JSON-Index

```
.locai/
├── DNA.md                     # Agent-Persönlichkeit (System Prompt)
├── MEMORY.md                  # Kuratiertes Langzeitgedächtnis
├── memory/
│   ├── 2026-02-23.md          # Tagesnotizen (auto-generiert)
│   ├── 2026-02-22.md
│   └── important/             # Manuell markierte wichtige Notizen
└── .memory-index.json         # Auto-generierter Embedding-Index (hidden)
```

**Warum Markdown statt SQLite/JSON:**
- Lesbar und editierbar für Menschen
- Git-trackbar (Diff-freundlich)
- Agent kann mit `read_file`/`write_file` direkt bearbeiten
- Kein Schema-Migration-Problem

**JSON-Index im Hintergrund:**
- `.memory-index.json` cached Embeddings für Semantic Search
- Wird bei Änderungen an .md Files automatisch neu gebaut
- Unsichtbar für User (dotfile)

### Embedding

- **Modell:** nomic-embed-text via Ollama `/api/embed`
- **Dimensionen:** 768
- **Similarity:** Cosine Similarity
- Cache in `.memory-index.json` (embedding + hash pro Memory-Eintrag)

### Auto-Inject

1. User-Message kommt rein
2. Embed User-Message → Vektor
3. Semantic Search über `.memory-index.json` (alle Memory-Files)
4. Filter: Score > 0.7
5. Top-N Memories innerhalb **2000 Token Budget** injizieren
6. Format: `"Bekannte Informationen:\n- [memory1]\n- [memory2]"`
7. DNA.md wird **immer** als System-Prompt injiziert

### Memory Lifecycle

| Phase | Aktion |
|-------|--------|
| **Create** | `save_memory` Tool → schreibt in `memory/YYYY-MM-DD.md` |
| **Retrieve** | `recall_memory` Tool → Semantic Search + Keyword Fallback |
| **Curate** | User/Agent verschiebt wichtiges nach `MEMORY.md` |
| **Prune** | Auto: >90 Tage Conversation, >30 Tage ohne Zugriff → Archiv |
| **Archive** | Verschoben nach `memory/archive/` (nicht gelöscht) |

### API Routes

| Route | Method | Beschreibung |
|-------|--------|-------------|
| `/api/memories` | GET | Alle Memories listen (Pagination) |
| `/api/memories` | POST | Neue Memory erstellen |
| `/api/memories/[id]` | DELETE | Memory löschen |
| `/api/memories/search?q=...` | GET | Semantic Search |
| `/api/memories/prune` | POST | Alte Memories archivieren |
| `/api/memories/reindex` | POST | Embedding-Index neu bauen |

---

## Consequences

- Markdown-Files sind die Single Source of Truth
- JSON-Index ist ein Cache, kann jederzeit rebuilt werden
- DNA.md ersetzt starre System-Prompts → Agent-Persönlichkeit wird konfigurierbar
- Memory wächst mit der Nutzung → Prune-Strategie verhindert Aufblähung
