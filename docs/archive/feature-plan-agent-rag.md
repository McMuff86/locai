# LocAI Feature Plan: Agent Mode + RAG Document Chat

> Erstellt: 2026-02-08
> Branch: `feature/agent-rag`

---

## Übersicht

Zwei zusammenhängende Features die LocAI von einem Chat-Interface zu einem echten lokalen AI-Assistenten machen:

1. **RAG Document Chat** – Chatten mit eigenen Dokumenten (PDF, TXT, MD, Code)
2. **Agent Mode** – Modell kann Tools aufrufen (Web-Suche, Dokument-Suche, Code-Exec, Files)

---

## Phase 1: RAG Document Chat

### Was schon da ist
- `src/lib/notes/embeddings.ts` – Chunking, Embedding (nomic-embed-text), Cosine Similarity
- `/api/notes/embed` – Embedding API für Notes
- `/api/notes/search` – Semantic Search über Notes
- JSONL-basierter Vektor-Store

### Was gebaut werden muss

#### 1.1 Document Upload & Processing
**Neue Files:**
- `src/lib/documents/` – Document Processing Module
  - `parser.ts` – PDF, TXT, MD, DOCX, Code-Dateien parsen
  - `chunker.ts` – Intelligentes Chunking (Paragraph-aware, Code-aware)
  - `store.ts` – Document Metadata Store (welche Docs, wann indexiert, Chunks)
  - `types.ts` – Document, Chunk, Index Interfaces

**API Routes:**
- `POST /api/documents/upload` – File Upload + Auto-Index
- `GET /api/documents` – Liste aller indexierten Dokumente
- `DELETE /api/documents/[id]` – Dokument + Embeddings entfernen
- `POST /api/documents/search` – Semantic Search über alle Dokumente

**Dependencies:**
- `pdf-parse` – PDF Text-Extraktion (lightweight, kein Native)
- `mammoth` – DOCX → Text (optional)

#### 1.2 RAG Pipeline im Chat
**Flow:**
```
User fragt → Query Embedding → Top-K Chunks suchen → Kontext in Prompt injizieren → Modell antwortet
```

**Änderungen in:**
- `src/hooks/useChat.ts` – RAG-Kontext vor dem Senden einbauen
- `src/lib/ollama.ts` – System Message mit Dokumenten-Kontext erweitern
- Neues: `src/lib/rag/pipeline.ts` – RAG Orchestration

**UI:**
- Document Manager Panel (Upload, Liste, Status)
- Im Chat: Badge/Indicator wenn RAG aktiv
- Source Citations in Antworten (welches Dokument, welcher Chunk)

#### 1.3 Vektor-Store Upgrade
- Aktuell: JSONL Flat-File (OK für Notes, skaliert nicht für viele Docs)
- **Option A:** Bei JSONL bleiben + In-Memory Index (bis ~10k Chunks OK)
- **Option B:** SQLite + `sqlite-vss` Extension (besser ab 10k+ Chunks)
- **Empfehlung:** Phase 1 mit Option A starten, Option B als Upgrade

---

## Phase 2: Agent Mode

### Konzept
Ollama unterstützt Tool-Calling seit v0.3+ (für kompatible Modelle wie llama3.1+, qwen2.5+, mistral).

Das Modell bekommt eine Liste von verfügbaren Tools und kann entscheiden, diese aufzurufen statt direkt zu antworten.

### 2.1 Tool-Calling Infrastructure
**Neue Files:**
- `src/lib/agents/` – Agent Module
  - `types.ts` – Tool Definition, ToolCall, ToolResult Interfaces
  - `registry.ts` – Tool Registry (registrieren, auflisten, ausführen)
  - `executor.ts` – Tool Execution Loop (Call → Execute → Feed Back → Repeat)
  - `tools/` – Einzelne Tool-Implementierungen

**Änderungen:**
- `src/lib/ollama.ts` – `tools` Parameter in Chat Request
- `src/hooks/useChat.ts` – Agent Loop (tool_calls erkennen, ausführen, zurückfüttern)

### 2.2 Built-in Tools

| Tool | Beschreibung | Priorität |
|------|-------------|-----------|
| `search_documents` | RAG-Suche über indexierte Dokumente | ⭐ P1 |
| `web_search` | SearXNG/DDG Websuche (existiert schon!) | ⭐ P1 |
| `read_file` | Datei lesen (mit Path-Validation) | ⭐ P1 |
| `write_file` | Datei schreiben/erstellen | P2 |
| `run_code` | Python/JS in Sandbox ausführen | P2 |
| `create_note` | Note in LocAI erstellen | P2 |
| `fetch_url` | Webseite abrufen + parsen | P2 |
| `generate_image` | ComfyUI Integration (existiert schon!) | P3 |

### 2.3 Agent UI
- Toggle: "Agent Mode" On/Off im Chat
- Tool-Call Visualisierung (welches Tool, Parameter, Ergebnis)
- Collapsible Tool-Execution Blocks in der Chat-Ansicht
- Indikator welche Tools aktiv sind

### 2.4 Agent Loop
```
User Message
    ↓
Ollama (with tools)
    ↓
┌─ Regular Response → Display
└─ Tool Call → Execute Tool → Feed Result → Ollama → (repeat)
```

Max 5-10 Iterationen pro Turn (Safety Limit).

---

## Implementierungs-Reihenfolge

### Sprint A: RAG Foundation (2-3 Nächte)
1. [ ] Document Upload API + Parser (PDF, TXT, MD)
2. [ ] Chunking + Embedding Pipeline (baut auf existierendem Code auf)
3. [ ] Document Manager UI (Upload, Liste, Delete)
4. [ ] RAG Pipeline im Chat (Query → Search → Inject → Respond)
5. [ ] Source Citations in Antworten

### Sprint B: Agent Foundation (2-3 Nächte)
1. [ ] Tool-Calling in ollama.ts integrieren
2. [ ] Tool Registry + Executor Loop
3. [ ] Tools: search_documents, web_search, read_file
4. [ ] Agent Mode Toggle im UI
5. [ ] Tool-Call Visualisierung im Chat

### Sprint C: Polish & Extend (1-2 Nächte)
1. [ ] run_code Tool (sandboxed)
2. [ ] write_file + create_note Tools
3. [ ] Conversation-aware RAG (Chat-History als Kontext)
4. [ ] Performance-Optimierung (Embedding Cache, Batch Processing)
5. [ ] Tests

---

## Technische Entscheidungen

### Embedding Model
- **nomic-embed-text** (bereits installiert) – 768 Dims, gut für Deutsch+Englisch
- Alternative: `mxbai-embed-large` (1024 Dims, etwas besser)

### Chunk Strategie
- **Documents:** 500 Tokens, 80 Token Overlap (wie aktuell)
- **Code:** Funktion/Klasse-aware Splitting
- **PDF:** Page-aware + Paragraph Splitting

### Tool-Calling Kompatibilität
Ollama Tool-Calling funktioniert mit:
- ✅ llama3.1, llama3.2
- ✅ qwen2.5, qwen3
- ✅ mistral, mixtral
- ❌ deepseek-r1 (kein natives Tool-Calling)
- ❌ dolphin (variiert)

→ Agent Mode nur für kompatible Modelle aktivieren, Fallback-UI für andere.

---

## Risiken & Offene Fragen

1. **VRAM:** Embedding Model + Chat Model gleichzeitig → nomic-embed-text ist klein (~270MB), sollte passen
2. **PDF Parsing:** `pdf-parse` ist gut für Text-PDFs, scheitert bei gescannten PDFs (braucht OCR)
3. **Tool-Calling Reliability:** Kleinere Modelle (7B) machen mehr Fehler bei Tool-Calls als grosse
4. **Security:** Code-Execution braucht Sandbox (Docker Container oder VM)
