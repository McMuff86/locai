# Knowledge Graph — Improvement Plan

> **Datum:** 2026-02-07  
> **Branch:** `nightly/07-02-ui-redesign`  
> **Erstellt durch:** Code-Review & Feature-Analyse

---

## Inhaltsverzeichnis

1. [Aktueller Stand](#aktueller-stand)
2. [Architektur-Übersicht](#architektur-übersicht)
3. [Code-Review Zusammenfassung](#code-review-zusammenfassung)
4. [Vergleich mit Best Practices](#vergleich-mit-best-practices)
5. [Improvements](#improvements)
   - [🐛 Bugs / Issues](#-bugs--issues)
   - [🎨 UI/UX Verbesserungen](#-uiux-verbesserungen)
   - [⚡ Performance](#-performance)
   - [🔧 Features (Quick Wins)](#-features-quick-wins)
   - [🚀 Features (Major)](#-features-major)
   - [🏗️ Architektur](#️-architektur)
6. [Priorisierte Roadmap](#priorisierte-roadmap)

---

## Aktueller Stand

### Was kann der Knowledge Graph?

Der Knowledge Graph ist ein **3D-Visualisierungstool für Markdown-Notizen**, das in LocAI als eigenständiger Tab unter `/notes/graph` lebt. Er bietet:

- **Wiki-Links** (`[[Notizname]]`): Explizite Verknüpfungen zwischen Notizen, extrahiert per Regex
- **Semantische Links**: KI-basierte Ähnlichkeit via Ollama Embeddings (`nomic-embed-text`), berechnet über Cosine Similarity
- **3D-Visualisierung**: Interaktiver Force-Directed Graph mit `react-force-graph-3d` (Three.js)
- **Text-Ansicht**: Alternative Listenansicht aller Links
- **Anpassbare Darstellung**: 4 Themes (Cyber, Obsidian, Neon, Minimal), 5 Node-Geometrien, Glow-Effekte, Labels, diverse Slider
- **Basisinteraktionen**: Zoom, Drag (Rotate), Pan, Node-Hover-Info, Node-Click → Notiz öffnen
- **Embedding-Generierung**: Streaming-basierter Embedding-Prozess mit Fortschrittsanzeige
- **Link-Filter**: Umschalten zwischen Wiki-Links, AI-Links oder allen
- **Export**: PNG-Screenshot des Graphen

### Datenquellen

| Quelle | Beschreibung |
|--------|-------------|
| Markdown-Dateien | Lokale `.md` Files, konfiguriert über `notesPath` in Settings |
| Wiki-Links | Per Regex `[[...]]` aus Content extrahiert (`parser.ts`) |
| Tags | Per Regex `#tagname` aus Content extrahiert |
| Embeddings | Via Ollama API (`nomic-embed-text`), gespeichert als `embeddings.jsonl` im Notes-Verzeichnis |

### Technologie-Stack

| Komponente | Technologie |
|-----------|-------------|
| Visualisierung | `react-force-graph-3d` v1.29.0 + `three` v0.164.1 |
| Embeddings | Ollama API (`/api/embeddings`) |
| Ähnlichkeit | Cosine Similarity (eigene Implementierung) |
| Chunking | Eigene `chunkText()` mit Overlap |
| Storage | JSONL-Datei (`embeddings.jsonl`) |
| API | Next.js API Routes (SSE Streaming) |
| State | React Hooks (`useGraph`) |

---

## Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                           │
│                                                         │
│  notes/graph/page.tsx                                   │
│  ├── GraphControls.tsx     (Settings, Filter, Actions)  │
│  ├── KnowledgeGraph.tsx    (3D Force-Graph Rendering)   │
│  └── GraphTextView.tsx     (Listenansicht)              │
│                                                         │
│  Hooks: useGraph.ts (State, GraphData-Berechnung)       │
│  Utils: graphUtils.ts (Themes, Colors)                  │
│  Types: types.ts (GraphSettings, GraphData, etc.)       │
│                                                         │
│  Context: NotesLayout → NotesContext                     │
│           (shared between notes + graph pages)           │
├─────────────────────────────────────────────────────────┤
│                      Backend (API Routes)               │
│                                                         │
│  /api/notes/embed          POST (Embedding-Generierung) │
│  /api/notes/semantic-links GET  (Similarity-Berechnung) │
│  /api/notes/search         GET  (Volltextsuche)         │
│                                                         │
│  Lib: embeddings.ts (chunkText, cosineSim, embed)       │
│       graph.ts (buildGraph - legacy, kaum genutzt)      │
│       parser.ts (Wikilink/Tag Extraktion)               │
│       search.ts (basicSearch, semanticSearch)            │
├─────────────────────────────────────────────────────────┤
│                      External                           │
│                                                         │
│  Ollama (/api/embeddings)   nomic-embed-text            │
│  Filesystem (Markdown Files + embeddings.jsonl)         │
└─────────────────────────────────────────────────────────┘
```

---

## Code-Review Zusammenfassung

### Stärken ✅

- **Saubere Komponentenstruktur**: Graph-Logik ist in UI-Komponenten, Hooks und Utils aufgeteilt
- **TypeScript-Typen**: Gut definierte Interfaces für `GraphData`, `GraphSettings`, `GraphNode`, `GraphLink`
- **Streaming-API**: Embedding-Generierung mit SSE-Stream und Fortschrittsanzeige ist gut gelöst
- **Theme-System**: Flexibles Theme-System mit 4 vordefinierten Themes
- **Security**: `sanitizeBasePath()` verhindert Path Traversal
- **Tests**: `embeddings.test.ts` mit guter Coverage für `chunkText` und `cosineSimilarity`
- **Error Handling**: Gutes Error Handling in der Embedding-Pipeline mit Timeout und Retry-Logik
- **Shared Context**: Clevere Nutzung von React Context (`NotesContext`) um State zwischen Notes- und Graph-Page zu teilen

### Schwächen ⚠️

- **`KnowledgeGraph.tsx` ist monolithisch** (280+ Zeilen): Three.js Node-Erstellung, UI-Controls und Graph-Konfiguration in einer Datei
- **`graph.ts` (lib) wird kaum genutzt**: `buildGraph()` wird nirgends importiert — die Graph-Daten werden direkt in `useGraph.ts` berechnet
- **`Record<string, unknown>` Type-Hack**: Dynamic import von `ForceGraph3D` nutzt unsicheres Casting mit `as never`
- **Keine Persistenz der Graph-Settings**: Settings gehen bei Seitenreload verloren
- **Keine Pagination/Virtualisierung**: Alle Notizen/Links werden auf einmal geladen und gerendert
- **Inkonsistente Sprachverwendung**: UI-Texte deutsch, Code-Kommentare gemischt deutsch/englisch
- **Fehlende Accessibility**: Keine ARIA-Labels, keine Keyboard-Navigation
- **Kein Caching**: Embeddings werden bei jedem API-Call vom Filesystem gelesen

---

## Vergleich mit Best Practices

### vs. Obsidian Graph View

| Feature | Obsidian | LocAI | Delta |
|---------|----------|-------|-------|
| 2D/3D Toggle | ✅ (2D default, 3D plugin) | 🟡 (nur 3D) | Fehlt: 2D-Ansicht |
| Lokale Suche im Graph | ✅ (Filter-Bar) | ❌ | Fehlt |
| Farbcodierung nach Ordner/Tag | ✅ | 🟡 (nur nach erstem Tag) | Ausbaufähig |
| Graph-Zoom auf Node-Nachbarschaft | ✅ ("Open local graph") | ❌ | Fehlt |
| Node-Grösse = Verlinkungsgrad | ✅ | ✅ | OK |
| Orphan-Nodes ausblenden | ✅ | ❌ | Fehlt |
| Echtzeit-Updates | ✅ | ❌ | Fehlt |
| Performance bei 1000+ Notes | ✅ | ❓ (ungetestet) | Risiko |

### vs. Neo4j Browser

| Feature | Neo4j | LocAI | Delta |
|---------|-------|-------|-------|
| Cypher/Query-Sprache | ✅ | ❌ | N/A (andere Zielgruppe) |
| Node-Details Panel | ✅ (Sidebar) | 🟡 (nur Hover-Tooltip) | Fehlt: Detail-Panel |
| Expand/Collapse | ✅ | ❌ | Fehlt |
| Relationship-Labels | ✅ | 🟡 (nur Link-Typ-Farbe) | Ausbaufähig |
| Multi-Select | ✅ | ❌ | Fehlt |

### Was macht einen guten KG in einem AI Chat-Tool?

1. **Chat-Integration**: Entities aus Chats automatisch in den Graph einfliessen lassen
2. **RAG-Retrieval**: Graph als Wissensquelle für AI-Antworten nutzen
3. **Bidirektionalität**: Aus dem Graph in den Chat navigieren (und umgekehrt)
4. **Kontextuelle Relevanz**: "Zeig mir verwandte Notizen zu dieser Konversation"
5. **Inkrementelle Updates**: Graph wächst automatisch mit jeder Interaktion

---

## Improvements

### 🐛 Bugs / Issues

#### B1: `graph.ts` (lib) ist toter Code

- **Beschreibung:** `buildGraph()` in `src/lib/notes/graph.ts` wird nirgends importiert. Die Graph-Daten werden stattdessen direkt in `useGraph.ts` via `useMemo` aufgebaut.
- **Warum:** Verwirrt Entwickler, die denken die Funktion würde verwendet. Unterschiedliche `NoteNode`/`NoteLink` Typen in `lib/notes/types.ts` vs. `components/notes/types.ts` erzeugen Verwirrung.
- **Aufwand:** S
- **Priorität:** 3
- **Umsetzung:** `graph.ts` entfernen oder Refactoring: Graph-Logik aus `useGraph.ts` in `graph.ts` verschieben und dort zentral pflegen. Typen konsolidieren.

#### B2: ForceGraph3D Dynamic Import Type-Hack

- **Beschreibung:** `ForceGraph3D` wird mit `Record<string, unknown>` importiert und `as never` gecastet. Das unterdrückt alle TypeScript-Warnungen, verliert aber jegliche Typsicherheit.
- **Warum:** Props werden zur Laufzeit nicht validiert — Fehler werden erst im Browser sichtbar, nicht beim Build.
- **Aufwand:** S
- **Priorität:** 2
- **Umsetzung:** Eigenes Type-Declaration-File erstellen (`react-force-graph-3d.d.ts`) oder einen Wrapper-Typ definieren, der die tatsächlich verwendeten Props korrekt typed.

#### B3: Settings gehen bei Seitenreload verloren

- **Beschreibung:** `GraphSettings` werden nur in React State gehalten (`useState` in `useGraph.ts`). Bei Reload → alles auf Default.
- **Warum:** Benutzer muss bei jedem Reload Theme, Glow, Labels etc. neu einstellen. Frustrierend.
- **Aufwand:** S
- **Priorität:** 1
- **Umsetzung:** Settings in `localStorage` persistieren. `useGraph.ts` → `useState` mit Initializer aus `localStorage`. `updateGraphSettings` zusätzlich in `localStorage` schreiben.

#### B4: Semantic Links Max-Cap von 50 ist hart codiert

- **Beschreibung:** In `useGraph.ts` Zeile `const maxSemanticLinks = 50` — bei vielen ähnlichen Notizen werden Links abgeschnitten ohne Nutzer-Feedback.
- **Warum:** Nutzer wundert sich, warum manche Links fehlen. Kein Hinweis in der UI.
- **Aufwand:** S
- **Priorität:** 2
- **Umsetzung:** Cap konfigurierbar machen (in `GraphSettings`). Wenn gekappt → Info-Badge: "Zeige 50 von 127 semantischen Links".

#### B5: Embedding-Generierung hat kein Modell-Fallback

- **Beschreibung:** `nomic-embed-text` ist hart codiert im Frontend (`useGraph.ts`). Wenn der User ein anderes Embedding-Modell installiert hat, kann er es nicht auswählen.
- **Warum:** Nutzer mit anderen Modellen (z.B. `mxbai-embed-large`, `all-minilm`) können sie nicht nutzen.
- **Aufwand:** S
- **Priorität:** 2
- **Umsetzung:** Embedding-Modell in Settings konfigurierbar machen. Liste der installierten Modelle von `/api/tags` filtern (nur Embedding-Modelle).

---

### 🎨 UI/UX Verbesserungen

#### U1: Node-Detail-Panel (Sidebar)

- **Beschreibung:** Beim Klick auf einen Node wird aktuell direkt zur Notiz navigiert. Es fehlt ein Zwischen-Panel das Notiz-Infos, verknüpfte Nodes und einen Preview zeigt.
- **Warum:** Schnelle Exploration ohne den Graph zu verlassen. Obsidian/Neo4j zeigen beide ein Detail-Panel.
- **Aufwand:** M
- **Priorität:** 1
- **Umsetzung:** Slide-in Panel rechts mit: Notiz-Titel, Tags, Content-Preview (erste 200 Zeichen), Liste verknüpfter Nodes, "Im Editor öffnen" Button. Single-Click = Panel, Double-Click = Navigation.

#### U2: 2D-Ansicht als Alternative

- **Beschreibung:** Aktuell nur 3D-Ansicht verfügbar. 3D ist visuell beeindruckend, aber für produktive Arbeit oft weniger praktisch.
- **Warum:** 2D ist übersichtlicher, performanter und besser für grosse Graphen. Obsidian nutzt Default 2D.
- **Aufwand:** M
- **Priorität:** 2
- **Umsetzung:** `react-force-graph-2d` als zweite Rendering-Option. Toggle in ViewMode: `text | 2D | 3D`. Die meisten Props sind kompatibel. Canvas-basierte Labels statt Three.js Sprites.

#### U3: Graph-Suche / Filter-Bar

- **Beschreibung:** Keine Möglichkeit, im Graph nach einem Node zu suchen oder zu einem bestimmten Node zu springen.
- **Warum:** Bei 50+ Notizen ist manuelles Suchen im 3D-Raum unpraktisch.
- **Aufwand:** S
- **Priorität:** 1
- **Umsetzung:** Suchfeld über dem Graph. Bei Eingabe: Matching Nodes hervorheben (Opacity-Reduktion auf andere), Kamera auf ersten Treffer zoomen via `graphRef.current.cameraPosition()`. Autocomplete mit Notiz-Titeln.

#### U4: Orphan-Nodes Toggle

- **Beschreibung:** Notizen ohne Verknüpfungen (Orphans) sind immer sichtbar und "schweben" herum.
- **Warum:** Verstopfen den Graph, sind für die Visualisierung uninteressant.
- **Aufwand:** S
- **Priorität:** 2
- **Umsetzung:** Toggle-Button "Orphans ausblenden". In `useGraph.ts` → `graphData` Memo: Nodes filtern die weder in Links source noch target vorkommen.

#### U5: Farbcodierung verbessern — Multi-Tag + Ordner

- **Beschreibung:** Aktuell wird nur der erste Tag für die Node-Farbe verwendet. Ordner/Pfad wird ignoriert.
- **Warum:** Notizen mit mehreren Tags oder in verschiedenen Ordnern bekommen keine visuelle Differenzierung.
- **Aufwand:** M
- **Priorität:** 3
- **Umsetzung:** Farb-Strategie konfigurierbar: "Nach erstem Tag", "Nach Ordner", "Nach Verbindungsgrad". Optional: Multi-Tag als Ring/Border um den Node (äusserer Ring = zweiter Tag).

#### U6: Hover-Controls verbessern

- **Beschreibung:** Beim Node-Hover wird nur Titel und "Klicken zum Öffnen" angezeigt. Tags, Link-Anzahl, Snippet fehlen.
- **Warum:** Mehr Kontext hilft bei der Exploration.
- **Aufwand:** S
- **Priorität:** 2
- **Umsetzung:** Hover-Tooltip erweitern: Tags als Chips, Anzahl Wiki-/Semantic-Links, erste 100 Zeichen Content als Preview.

#### U7: Responsive Design / Mobile

- **Beschreibung:** 3D Graph ist auf Mobile kaum bedienbar. Controls sind zu klein, Touch-Gesten unklar.
- **Warum:** LocAI soll auch auf Tablets/Phones nutzbar sein.
- **Aufwand:** M
- **Priorität:** 3
- **Umsetzung:** Touch-optimierte Controls (grössere Buttons), Pinch-to-Zoom, automatisches Fallback auf 2D bei `< 768px`, versteckbare Advanced Settings.

---

### ⚡ Performance

#### P1: Embedding-JSONL wächst unbegrenzt

- **Beschreibung:** Jede Notiz generiert mehrere Chunks. Bei 500 Notizen mit je 5 Chunks → 2500 Embedding-Einträge. JSONL wird bei jedem API-Call komplett gelesen und geparst.
- **Warum:** Lineares Lesen + Parsen von tausenden JSON-Zeilen wird bei grossen Sammlungen zum Bottleneck.
- **Aufwand:** M
- **Priorität:** 2
- **Umsetzung:**
  - Kurzfristig: In-Memory Cache im API-Server mit Invalidation bei Datei-Änderungen (`fs.watch`)
  - Langfristig: SQLite als Storage (`better-sqlite3`) mit Index auf `noteId`

#### P2: Pairwise Similarity ist O(n²)

- **Beschreibung:** In `/api/notes/semantic-links` wird für alle N Notizen eine N×N Vergleichsmatrix berechnet.
- **Warum:** Bei 100 Notizen = 4950 Vergleiche (OK). Bei 1000 Notizen = 499.500 Vergleiche (langsam). Bei 5000 = 12.5M (inakzeptabel).
- **Aufwand:** L
- **Priorität:** 2
- **Umsetzung:**
  - Kurzfristig: Caching der Similarity-Matrix, nur Neuberechnung bei geänderten Embeddings
  - Langfristig: Approximate Nearest Neighbors (ANN) mit HNSW-Index (z.B. `hnswlib-node` oder `usearch`)

#### P3: Three.js Node-Objekte werden bei jedem Settings-Change neu erstellt

- **Beschreibung:** `createNodeObject` in `KnowledgeGraph.tsx` ist ein `useCallback` das sich bei jeder Settings-Änderung neu berechnet (wegen `[settings]` Dependency). Jede Änderung → alle Nodes werden neu gerendert.
- **Warum:** Bei einem Graph mit 200 Nodes und Glow-Effekten (4 extra Meshes pro Node) = 1000 Three.js Objekte werden neu erstellt.
- **Aufwand:** M
- **Priorität:** 2
- **Umsetzung:** Node-Objects cachen und nur bei relevanten Settings-Changes (Geometry, Glow, Labels) neu erstellen. Andere Settings (Opacity, Size) via Material-Updates lösen statt Neu-Erstellung. Oder: `useMemo` mit granularer Dependency.

#### P4: Canvas-Labels sind teuer

- **Beschreibung:** Für jedes Label wird ein neuer HTML Canvas erstellt, Text gerendert, Texture erzeugt und als Sprite angehängt.
- **Warum:** Bei 100 Nodes = 100 Canvas-Elemente + 100 Textures. Memory-intensiv und GC-belastend.
- **Aufwand:** M
- **Priorität:** 3
- **Umsetzung:** Texture Atlas: Alle Labels auf einem Canvas rendern und UV-Mapping verwenden. Oder: CSS2DRenderer für HTML-basierte Labels (leichtgewichtiger als Sprites).

---

### 🔧 Features (Quick Wins)

#### Q1: Keyboard Shortcuts

- **Beschreibung:** Keine Keyboard-Shortcuts für Graph-Interaktionen.
- **Warum:** Power-User wollen schnell navigieren: `+`/`-` für Zoom, `R` für Reset, `F` für Fit, `Space` für Pause, `1`-`4` für Theme-Wechsel.
- **Aufwand:** S
- **Priorität:** 2
- **Umsetzung:** `useEffect` mit `keydown` Listener. Nur aktiv wenn Graph-Container fokussiert.

#### Q2: Legende mit Link-Typ-Erklärung

- **Beschreibung:** Die bestehende Legende zeigt nur Linienfarben. Für neue Benutzer ist der Unterschied zwischen Wiki-Link und Semantic-Link unklar.
- **Warum:** Besseres Verständnis der Visualisierung.
- **Aufwand:** S
- **Priorität:** 3
- **Umsetzung:** Tooltip bei Hover über Legende: "Wiki-Links: Explizite [[Verknüpfungen]] in Notizen", "Semantisch: KI-berechnete Ähnlichkeit (Cosine Similarity)".

#### Q3: "Lokaler Graph" (Nachbarschafts-Ansicht)

- **Beschreibung:** Möglichkeit, nur einen Node und seine direkten Nachbarn anzuzeigen (1-Hop oder 2-Hop Radius).
- **Warum:** Bei grossen Graphen will man oft nur den Kontext einer bestimmten Notiz sehen. Obsidian's "Open local graph" ist eines der meistgenutzten Features.
- **Aufwand:** M
- **Priorität:** 1
- **Umsetzung:** Rechtsklick-Menü auf Node → "Lokaler Graph". Filtert `graphData` auf Nodes die innerhalb von N Hops erreichbar sind. Depth-Slider (1-3).

#### Q4: Similarity-Score auf Links anzeigen

- **Beschreibung:** Semantische Links zeigen in der Text-Ansicht den Score, aber nicht im 3D-Graph. Man sieht nicht, wie stark die Ähnlichkeit ist.
- **Warum:** Visuelle Differenzierung: Stärkere Ähnlichkeit = dickerer/hellerer Link.
- **Aufwand:** S
- **Priorität:** 2
- **Umsetzung:** `linkWidth` als Funktion der Similarity: `width = baseLinkWidth * (link.similarity || 0.5)`. Hover über Link → Tooltip mit Score.

#### Q5: Graph-State URL-Sharing

- **Beschreibung:** Fokussierter Node, Filter-Einstellungen und Zoom-Level sind nicht in der URL.
- **Warum:** Ermöglicht Bookmarking und Sharing von bestimmten Graph-Ansichten.
- **Aufwand:** S
- **Priorität:** 3
- **Umsetzung:** Query-Parameter: `?node=abc&filter=wiki&theme=cyber`. Bei Load: Graph auf Node fokussieren.

#### Q6: Batch-Refresh für Embeddings

- **Beschreibung:** Aktuell werden bei "Embeddings" immer ALLE Notizen neu embedded. Es gibt keinen inkrementellen Update.
- **Warum:** Zeitersparnis: Nur geänderte Notizen neu embedden. Bei 500 Notizen dauert Full-Rebuild mehrere Minuten.
- **Aufwand:** M
- **Priorität:** 1
- **Umsetzung:** `updatedAt` der Notiz mit `createdAt` des Embeddings vergleichen. Nur Notizen embedden deren Content neuer ist als das letzte Embedding. Button-Label: "X Notizen aktualisieren" statt "Embeddings".

---

### 🚀 Features (Major)

#### M1: Chat-zu-Graph Integration (Entity Extraction)

- **Beschreibung:** Automatisch Entities (Personen, Konzepte, Tools, Orte) aus Chat-Nachrichten extrahieren und als Nodes in den Graph einfügen.
- **Warum:** Der Knowledge Graph wächst organisch mit der Nutzung. Keine manuelle Pflege nötig. DAS Killer-Feature für ein AI Chat-Tool.
- **Aufwand:** L
- **Priorität:** 1
- **Umsetzung:**
  1. NER (Named Entity Recognition) via Ollama: Prompt-Template das aus Chat-Messages Entities extrahiert (JSON output)
  2. Neue Node-Typen: `chat-entity` neben `note`
  3. Neue Link-Typen: `mentioned-in`, `related-to`
  4. Background-Job: Nach jedem Chat → Entity-Extraction, Deduplizierung, Graph-Update
  5. UI: Chat-Entities als eigene Farbe/Form im Graph

#### M2: RAG-Integration (Graph als Retrieval-Quelle)

- **Beschreibung:** Den Knowledge Graph und Embeddings als Kontext-Quelle für AI-Antworten nutzen.
- **Warum:** "Frag dein Wissen" — AI-Antworten basierend auf deinen eigenen Notizen. Massiver Mehrwert.
- **Aufwand:** L
- **Priorität:** 1
- **Umsetzung:**
  1. Bei Chat-Nachricht: Query-Embedding erstellen
  2. Semantic Search in Embeddings: Top-K relevante Chunks finden
  3. Graph-Walk: Von gefundenen Notizen über Links navigieren → zusätzlichen Kontext einsammeln
  4. Prompt-Augmentation: Gefundene Chunks als System-Context injizieren
  5. UI: "Quellen anzeigen" Button unter AI-Antworten → zeigt welche Notizen verwendet wurden

#### M3: Multi-Graph / Wissensdomänen

- **Beschreibung:** Verschiedene Graphen für verschiedene Themen/Projekte (z.B. "Arbeit", "Privat", "Projekt X").
- **Warum:** Nicht alle Notizen gehören in einen Graphen. Fokussierte Ansichten für verschiedene Kontexte.
- **Aufwand:** L
- **Priorität:** 3
- **Umsetzung:** Mehrere `notesPath`-Einträge in Settings. Dropdown zum Wechseln. Separates Embedding-File pro Graph. Option: Graphen mergen für übergreifende Ansicht.

#### M4: Export / Import (Obsidian-kompatibel)

- **Beschreibung:** Graph-Daten exportieren als JSON, Markdown mit Frontmatter, oder Obsidian-kompatibles Format.
- **Warum:** Vendor-Lock-In vermeiden. Interoperabilität mit Obsidian-Ökosystem.
- **Aufwand:** M
- **Priorität:** 2
- **Umsetzung:**
  - Export: JSON (Nodes + Edges), Markdown (mit YAML Frontmatter + `[[Links]]`), Obsidian Vault-Struktur
  - Import: Obsidian Vault einlesen, Markdown mit Frontmatter parsen
  - Format: `{ nodes: [...], edges: [...], metadata: { ... } }`

#### M5: Zeitbasierte Graph-Ansicht (Timeline)

- **Beschreibung:** Graph-Visualisierung mit Zeitachse — wann wurden welche Notizen erstellt und verknüpft?
- **Warum:** Wissensaufbau über Zeit nachvollziehen. "Was habe ich letzte Woche gelernt?"
- **Aufwand:** L
- **Priorität:** 3
- **Umsetzung:** Zusätzliche Visualisierung mit `createdAt`/`updatedAt` als X-Achse. Nodes positioniert nach Erstellungsdatum. Links zeigen wann sie entstanden sind. Filter: Zeitraum-Slider.

#### M6: Collaborative Graph (Multi-User)

- **Beschreibung:** Mehrere Benutzer können am selben Knowledge Graph arbeiten.
- **Warum:** Team-Wissen teilen und gemeinsam aufbauen.
- **Aufwand:** XL
- **Priorität:** 3
- **Umsetzung:** Langfrist-Vision. Erfordert: Backend-Storage (DB), User-Auth, Conflict Resolution, Real-time Sync (WebSocket/CRDT).

---

### 🏗️ Architektur

#### A1: Graph-Logik konsolidieren

- **Beschreibung:** Graph-Berechnung ist verteilt: `lib/notes/graph.ts` (unused), `useGraph.ts` (actual), `types.ts` hat doppelte Typen (`NoteNode`/`GraphNode`).
- **Warum:** Single Source of Truth für Graph-Logik. Weniger Verwirrung.
- **Aufwand:** M
- **Priorität:** 1
- **Umsetzung:**
  1. `lib/notes/graph.ts` → Graph-Berechnung hierhin verschieben (pure functions, testbar)
  2. `useGraph.ts` → nur noch State-Management und API-Calls
  3. Typen konsolidieren: `GraphNode` und `NoteNode` mergen
  4. Tests für Graph-Berechnung schreiben

#### A2: KnowledgeGraph.tsx aufteilen

- **Beschreibung:** Die Datei enthält Three.js Node-Erstellung, UI-Controls, Event-Handler und Graph-Konfiguration — 280+ Zeilen.
- **Warum:** Bessere Wartbarkeit, einfacheres Testing, klarere Verantwortlichkeiten.
- **Aufwand:** M
- **Priorität:** 2
- **Umsetzung:**
  - `GraphCanvas.tsx` → ForceGraph3D-Rendering
  - `GraphNodeFactory.ts` → `createNodeObject()` als eigenes Modul
  - `GraphOverlay.tsx` → Floating Controls + Hover-Info
  - `KnowledgeGraph.tsx` → Orchestrierung

#### A3: Embedding-Storage abstrahieren

- **Beschreibung:** Storage ist direkt an JSONL-Dateien gekoppelt. Kein Interface/Abstraction Layer.
- **Warum:** Erschwert Wechsel zu SQLite, PostgreSQL oder anderen Storage-Lösungen.
- **Aufwand:** M
- **Priorität:** 2
- **Umsetzung:**
  ```typescript
  interface EmbeddingStore {
    load(noteId?: string): Promise<EmbeddingEntry[]>;
    save(entries: EmbeddingEntry[]): Promise<void>;
    remove(noteId: string): Promise<void>;
    findSimilar(embedding: number[], threshold: number, limit: number): Promise<EmbeddingSearchResult[]>;
  }
  ```
  Implementierungen: `JsonlEmbeddingStore`, `SqliteEmbeddingStore`

#### A4: API-Layer für Graph-Daten

- **Beschreibung:** Graph-Daten werden komplett im Frontend berechnet (`useMemo` in `useGraph.ts`). Die API liefert nur Raw-Notes und Raw-Links.
- **Warum:** Bei grossen Graphen soll die Berechnung serverseitig passieren. Ermöglicht Caching und bessere Performance.
- **Aufwand:** L
- **Priorität:** 3
- **Umsetzung:** Neuer API-Endpoint `/api/notes/graph` der fertige `GraphData` liefert (Nodes + Links + Metadata). Server-side Caching. Client macht nur noch Rendering.

#### A5: Event-System für Graph-Updates

- **Beschreibung:** Es gibt kein Benachrichtigungssystem wenn sich Notizen ändern. Graph zeigt veraltete Daten bis zum manuellen Reload.
- **Warum:** Real-time Updates: Notiz speichern → Graph aktualisiert sich automatisch.
- **Aufwand:** M
- **Priorität:** 2
- **Umsetzung:** Server-Sent Events (SSE) oder WebSocket. Bei Note-Save → Event pushen → Client aktualisiert `graphData`. Alternativ: `useSWR` mit Polling.

---

## Priorisierte Roadmap

### Phase 1: Foundation (Prio 1 — Sofort)

| ID | Improvement | Aufwand | Impact |
|----|-----------|---------|--------|
| B3 | Settings-Persistenz (localStorage) | S | Hoch — frustrierendster Bug |
| U1 | Node-Detail-Panel | M | Hoch — Core UX |
| U3 | Graph-Suche / Filter-Bar | S | Hoch — unverzichtbar für Nutzbarkeit |
| Q3 | Lokaler Graph (Nachbarschaft) | M | Hoch — Obsidian's Killer-Feature |
| Q6 | Inkrementelle Embeddings | M | Hoch — Time-Saver |
| A1 | Graph-Logik konsolidieren | M | Hoch — technische Schulden |

### Phase 2: Power Features (Prio 1-2)

| ID | Improvement | Aufwand | Impact |
|----|-----------|---------|--------|
| M1 | Chat-zu-Graph (Entity Extraction) | L | Sehr Hoch — Differenzierung |
| M2 | RAG-Integration | L | Sehr Hoch — "Frag dein Wissen" |
| U2 | 2D-Ansicht | M | Hoch — Usability |
| B2 | ForceGraph3D Type-Fix | S | Mittel — DX |
| B4 | Semantic-Links Cap konfigurierbar | S | Mittel — Transparenz |
| B5 | Embedding-Modell konfigurierbar | S | Mittel — Flexibilität |

### Phase 3: Polish & Scale (Prio 2-3)

| ID | Improvement | Aufwand | Impact |
|----|-----------|---------|--------|
| P1 | Embedding-Cache / SQLite | M | Hoch bei Scale |
| P2 | ANN statt O(n²) | L | Hoch bei Scale |
| P3 | Node-Object Caching | M | Mittel |
| A2 | KnowledgeGraph.tsx aufteilen | M | Mittel — Wartbarkeit |
| A3 | Embedding-Storage abstrahieren | M | Mittel — Zukunftssicherheit |
| M4 | Export/Import (Obsidian) | M | Mittel — Interoperabilität |
| U4 | Orphan-Nodes Toggle | S | Mittel |
| Q1 | Keyboard Shortcuts | S | Mittel |
| Q4 | Similarity auf Links | S | Mittel |

### Phase 4: Vision (Prio 3)

| ID | Improvement | Aufwand | Impact |
|----|-----------|---------|--------|
| M3 | Multi-Graph | L | Nice-to-have |
| M5 | Timeline-Ansicht | L | Nice-to-have |
| U5 | Multi-Tag Farbcodierung | M | Nice-to-have |
| U7 | Mobile/Responsive | M | Nice-to-have |
| A4 | Server-side Graph API | L | Nice-to-have |

---

## Top-5 Verbesserungen (Executive Summary)

1. **🔧 Settings-Persistenz + Graph-Suche** (S+S) — Fundamentale UX-Fixes die sofort Frustration reduzieren
2. **🎨 Node-Detail-Panel + Lokaler Graph** (M+M) — Verwandelt den Graph von "hübsche Demo" zu "produktives Tool"
3. **⚡ Inkrementelle Embeddings** (M) — Bei 100+ Notizen ist Full-Rebuild nicht zumutbar
4. **🚀 Chat-zu-Graph Entity Extraction** (L) — DAS Differenzierungsmerkmal: Knowledge Graph der automatisch wächst
5. **🚀 RAG-Integration** (L) — "Frag dein Wissen" macht den Graph zum Kern des AI-Erlebnisses

---

*Dieses Dokument sollte als lebendes Dokument behandelt werden und bei Umsetzung der Verbesserungen aktualisiert werden.*
