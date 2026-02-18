# ADR-002: RAG Architecture Review & Upgrade Strategy

**Status:** Proposed  
**Datum:** 2026-02-18  
**Autor:** 🏗️ Architect Agent (Sprint 5)  
**Sprint:** Sprint 5 – Agent Evolution & Premium Polish  
**Branch:** `sprint5/arch-workflow-engine`

---

## Kontext

Das bestehende RAG-System in `src/lib/documents/` implementiert eine einfache Pipeline:

1. **Chunking:** 500 Chars (fix), 80 Chars Overlap
2. **Embedding:** `nomic-embed-text` via Ollama (768 Dimensionen)
3. **Search:** Reiner Cosine-Similarity-Vergleich mit Threshold 0.3
4. **Context:** Top-K Chunks (K=5) werden in den Prompt injiziert

### Aktuelle Schwächen (analysiert aus Codebase)

| Schwäche | Datei | Impact |
|----------|-------|--------|
| Fixe 500-Char-Chunks zerschneiden semantische Einheiten (mitten im Satz) | `constants.ts` | Niedrige Recall-Qualität |
| Nur Cosine-Similarity – kein Keyword-Matching | `rag.ts` | Exakte Begriffe werden übersehen |
| Kein Re-Ranking | `rag.ts` | Schlechte Chunk-Reihenfolge |
| Keine Quellenangabe im Chat | `rag.ts:injectRAGContext()` | User-Trust niedrig |
| Context Window nicht dynamisch (fix K=5) | `constants.ts` | Entweder zu viel oder zu wenig Context |
| Alle Embeddings im Memory geladen | `store.ts` | Skaliert schlecht bei vielen Docs |

---

## Entscheidungen

### 1. Chunk-Strategie: Hybrides Chunking beibehalten + Verbesserungen

**Analyse der bestehenden Implementierung:**

Der Chunker in `chunker.ts` ist bereits typ-aware (Markdown → Header-Split, Code → Funktions-Boundaries, TXT/PDF → Paragraph-Split). Dies ist gut. Das Problem ist die fixe Char-Größe.

**Option A: Semantic Chunking via Sentence Transformers**  
→ Erfordert separate Python-Binary oder API-Call  
→ **Abgelehnt** (Dependency-Hell, kein Ollama-nativer Support)

**Option B: LLM-basiertes Chunking**  
→ LLM teilt Text selbst auf  
→ **Abgelehnt** (zu langsam für Indexierung, teuer in VRAM)

**Option C: Verbessertes Regelbasiertes Chunking (GEWÄHLT)**  
→ Größere Chunks (800–1200 Chars statt 500)  
→ Overlap erhöhen (150 Chars statt 80)  
→ Sentence-Boundary-Awareness: Chunk endet immer am Satzende  
→ Erhält bestehende Markdown/Code-Logik  

**Konkrete Änderungen:**

```typescript
// src/lib/documents/constants.ts (aktuell)
CHUNK_CONFIG = {
  PDF:  { chunkSize: 500, chunkOverlap: 80 },
  TXT:  { chunkSize: 500, chunkOverlap: 80 },
  MD:   { chunkSize: 500, chunkOverlap: 80 },
  CODE: { chunkSize: 400, chunkOverlap: 60 },
}

// NEU (Sprint 5)
CHUNK_CONFIG = {
  PDF:  { chunkSize: 1000, chunkOverlap: 150 },  // Paragraph-aware
  TXT:  { chunkSize: 800,  chunkOverlap: 120 },  // Sentence-boundary
  MD:   { chunkSize: 1200, chunkOverlap: 150 },  // Header-section-aware (kein Limit nötig bei kleinen Sections)
  CODE: { chunkSize: 600,  chunkOverlap: 80  },  // Function-block-aware
  DOCX: { chunkSize: 800,  chunkOverlap: 120 },
}
```

**Sentence-Boundary Helper (neu in `chunker.ts`):**

```typescript
function snapToSentenceBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  // Finde letztes Satzende (., !, ?) vor maxLength
  const sentenceEnd = /[.!?]\s+/g;
  let lastEnd = maxLength;
  for (const match of text.matchAll(sentenceEnd)) {
    if (match.index! < maxLength) lastEnd = match.index! + match[0].length;
    else break;
  }
  return text.slice(0, lastEnd).trim();
}
```

**Migration:** Bestehende indizierte Dokumente müssen **re-indiziert** werden wenn Chunk-Config geändert wird. Ein `/api/documents/reindex` Endpoint (oder UI-Button) ist nötig.

---

### 2. Hybrid Search: BM25 + Cosine Similarity

**Entscheidung: Hybrid Search implementieren (FEAT-2 im Sprint)**

**Warum Hybrid?**
- **Cosine Similarity** (aktuell): Semantische Ähnlichkeit – gut für konzeptuelle Anfragen ("was ist X?"), schlecht für exakte Begriffe ("fehlermeldung xyz")
- **BM25** (neu): Keyword-basiert – gut für exakte Begriffe, schlecht für Synonyme
- **Hybrid** (BM25 + Cosine): Beste beider Welten

**Implementierung (ohne externe Bibliotheken):**

BM25 kann in reinem JavaScript implementiert werden:

```typescript
// src/lib/documents/bm25.ts (NEU)

interface BM25Params {
  k1: number;   // Term frequency saturation (default: 1.5)
  b: number;    // Length normalization (default: 0.75)
}

class BM25Index {
  private termFrequency: Map<string, Map<number, number>>;  // term → docId → tf
  private documentFrequency: Map<string, number>;            // term → df
  private documentLengths: number[];
  private avgDocLength: number;
  
  build(documents: string[]): void
  score(query: string, docIndex: number): number
  search(query: string, topK: number): Array<{ index: number; score: number }>
}
```

**Hybrid Scoring:**

```typescript
// Normalisierter BM25 Score: 0–1
const bm25Score = normalize(bm25.score(query, docIdx));
// Cosine Similarity: bereits 0–1
const cosineScore = cosineSimilarity(queryEmbedding, docEmbedding);

// Gewichtetes Hybrid-Score
const SEMANTIC_WEIGHT = 0.7;   // Semantic dominiert für Allround-Queries
const KEYWORD_WEIGHT = 0.3;    // BM25 als Tiebreaker

const hybridScore = (SEMANTIC_WEIGHT * cosineScore) + (KEYWORD_WEIGHT * bm25Score);
```

**Adaptive Gewichtung (optional, Phase 2):**
```typescript
// Wenn Query kurz + konkret (< 3 Wörter) → BM25 höher gewichten
const isKeywordQuery = query.split(' ').length <= 3;
const semanticWeight = isKeywordQuery ? 0.5 : 0.7;
const keywordWeight = isKeywordQuery ? 0.5 : 0.3;
```

**BM25-Index-Persistenz:**  
BM25 Index wird **on-demand** aus den Chunk-Texten berechnet (kein separates Speichern nötig). Chunks sind bereits in `document-embeddings.jsonl` gespeichert.

---

### 3. Context Window Management

**Problem:** Aktuell werden fix 5 Chunks injiziert, unabhängig von:
- Größe der Chunks
- Verfügbarem Kontext-Window des Modells
- Relevanz-Spread der Chunks

**Entscheidung: Dynamisches Context Budget**

```typescript
// src/lib/documents/contextManager.ts (NEU)

interface ContextBudget {
  /** Maximale Token für RAG-Context (geschätzt: chars / 4) */
  maxTokens: number;
  /** Maximale Chunk-Anzahl */
  maxChunks: number;
  /** Minimale Similarity für Inclusion */
  minSimilarity: number;
}

function buildDynamicContext(
  results: DocumentSearchResult[],
  budget: ContextBudget
): DocumentSearchResult[] {
  let usedTokens = 0;
  const selected: DocumentSearchResult[] = [];
  
  for (const result of results) {  // results already sorted by score
    if (result.score < budget.minSimilarity) break;
    const chunkTokens = Math.ceil(result.chunk.content.length / 4);
    if (usedTokens + chunkTokens > budget.maxTokens) break;
    if (selected.length >= budget.maxChunks) break;
    selected.push(result);
    usedTokens += chunkTokens;
  }
  
  return selected;
}
```

**Modell-aware Budgets:**

```typescript
const MODEL_CONTEXT_BUDGETS: Record<string, ContextBudget> = {
  // Kleine Modelle: knappes Budget
  'phi3': { maxTokens: 800, maxChunks: 3, minSimilarity: 0.4 },
  'llama3.2:1b': { maxTokens: 800, maxChunks: 3, minSimilarity: 0.4 },
  
  // Standard-Modelle: normales Budget
  'default': { maxTokens: 2000, maxChunks: 5, minSimilarity: 0.3 },
  
  // Große Modelle mit großem Context: erweitertes Budget
  'llama3.1:70b': { maxTokens: 4000, maxChunks: 10, minSimilarity: 0.25 },
  'qwen2.5:72b': { maxTokens: 4000, maxChunks: 10, minSimilarity: 0.25 },
};
```

---

### 4. Re-Ranking Strategy

**Entscheidung: Cross-Encoder Re-Ranking – PHASE 3 (nicht Sprint 5)**

Ein Cross-Encoder (wie `ms-marco-MiniLM`) wäre ideal für Re-Ranking, ist aber:
- Nicht lokal via Ollama verfügbar
- Erfordert eigene Python-Inferenz

**Sprint 5 Alternative: LLM-based Re-Ranking (optional, bestehend)**

```typescript
// Nutze das Chat-LLM für Re-Ranking (kostet LLM-Tokens)
async function rerankWithLLM(
  query: string,
  chunks: DocumentChunk[],
  model: string,
  host?: string
): Promise<DocumentChunk[]> {
  const prompt = `
Gegeben diese Frage: "${query}"
Sortiere die folgenden Text-Auszüge nach Relevanz (nur die Nummern, kommagetrennt):
${chunks.map((c, i) => `[${i+1}] ${c.content.slice(0, 200)}...`).join('\n')}
`;
  // ... LLM call → parse ranking → reorder
}
```

**Risiko:** Erhöht Latenz erheblich für RAG-Queries.  
**Empfehlung:** Als **opt-in Flag** implementieren, default: off.

---

### 5. Quellenangabe im Chat (Source Citations)

**Entscheidung: Structured Source Metadata in RAG Injection**

Die bestehende `injectRAGContext()` Funktion fügt Quellen als Fließtext hinzu. Sprint 5 soll dies strukturierter machen.

**Neue Chunk-Referenz-Syntax:**

```
Chunk 1 [QUELLE: dokument.pdf, Chunk #3]
```

Dann im UI (UI/UX Agent): Collapsible Source Citations mit Link auf Document Details.

**Änderung in `rag.ts`:**

```typescript
// Chunk-Header mit maschinenlesbarer Referenz
contextParts.push(`### [QUELLE-${i+1}: ${sourceName} | chunk:${chunk.id}]`);
```

Das Frontend parst `[QUELLE-N: ...]` aus der LLM-Antwort und rendert klickbare Citations.

---

## Implementierungs-Reihenfolge (für Coder Agent FEAT-2)

1. **Schritt 1:** `constants.ts` → Chunk-Config aktualisieren (größere Chunks)
2. **Schritt 2:** `chunker.ts` → `snapToSentenceBoundary()` Helper hinzufügen
3. **Schritt 3:** `bm25.ts` → BM25-Implementierung
4. **Schritt 4:** `rag.ts` → `searchDocuments()` auf Hybrid-Score umstellen
5. **Schritt 5:** `contextManager.ts` → Dynamisches Context Budget
6. **Schritt 6:** `rag.ts:injectRAGContext()` → Source Citations Format
7. **Schritt 7:** UI für Source Citations (UI/UX Agent)
8. **Optional:** Re-Index Endpoint + UI-Button

---

## Skalierbarkeit

**Aktuelles Problem:** `loadDocumentEmbeddings()` lädt alle Embeddings in Memory.  
Bei 500 Docs × 100 Chunks × 768 Dims × 4 Bytes = ~147 MB – problematisch.

**Sprint 5 Mitigation (pragmatisch):**  
- Lazy Loading: Embeddings werden per Document-ID geladen, nicht alle auf einmal
- Streaming JSONL-Parsing (bereits in `store.ts` vorhanden, aber load-all pattern)

**Langfristig (Phase 3):** Echte Vektordatenbank (hnswlib-node, usearch, oder sqlite-vec).  
→ Wird in ADR-003 (Phase 3) behandelt.

---

## Metriken für Erfolg

| Metrik | Vorher | Ziel Sprint 5 |
|--------|--------|---------------|
| Chunk-Qualität (subjektiv: ganze Sätze?) | ~60% | >90% |
| Recall bei Keyword-Queries | ~50% | >75% |
| Context-Token-Effizienz | Fix 5×500=2500 chars | Dynamisch 2000 Tokens max |
| Quellenangaben im Chat | Nein | Ja (collapsible) |

---

## Keine Breaking Changes

Die bestehende `searchDocuments()` API bleibt kompatibel. BM25 ist ein internes Implementierungs-Detail. Bestehende Aufrufe in:
- `src/lib/agents/tools/searchDocuments.ts`
- `src/app/api/documents/search/route.ts`

…müssen **nicht** geändert werden.

---

## Referenzen

- `src/lib/documents/chunker.ts` – Bestehender Chunker
- `src/lib/documents/rag.ts` – Bestehende Semantic Search
- `src/lib/documents/constants.ts` – Chunk-Konfiguration
- `src/lib/documents/store.ts` – Embedding Storage
- Sprint 5 Backlog → ARCH-2, FEAT-2, UI-2
- [BM25 Algorithmus](https://en.wikipedia.org/wiki/Okapi_BM25) – Robertson & Zaragoza, 2009
