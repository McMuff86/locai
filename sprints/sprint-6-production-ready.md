# Sprint 6 – Production Ready & Flow Power

**Zeitraum:** 01.03 – 14.03.2026  
**Ziel:** Workflow Engine hardenen, Memory-System einführen, Multi-Provider Support

---

## 🔴 Prio 1: Workflow Engine Hardening

### ENGINE-1: Per-Node Settings durchreichen
- [x] Temperature + maxIterations aus AgentNodeConfig im Flow-Compiler auslesen
- [x] `compileVisualWorkflowToPlan()` erweitern: per-Step Config in compiled Plan
- [x] Workflow-API per-Step Config an `executeAgentLoop()` durchreichen
- [x] UI Felder (ConfigPanel) sind bereits da (Sprint 5, commit 4a8b049)

### ENGINE-2: write_file Overwrite Default
- [x] `write_file` Tool: Default `mode: "overwrite"` wenn File existiert
- [x] Oder: Agent bekommt Option "overwrite" direkt im Tool-Schema

### ENGINE-3: Step-Tool-Isolation
- [x] Agent soll Tools nur im zugewiesenen Step nutzen (Step 1 "read" soll nicht write_file callen)
- [x] Option: `enabledTools` per Step statt global

### ENGINE-4: Flow Builder Streaming
- [x] Live-Output im Output-Node während Workflow läuft (auto-scroll, typing indicator, expand toggle, per-step label, token counter)
- [x] Streaming-Events in der Flow-UI anzeigen (nicht nur Logs)

### ENGINE-5: Template Testing
- [x] Alle 7 Flow-Templates mit lokalen Modellen (qwen3, phi4) durchlaufen
- [x] Bugs fixen, Prompts optimieren
- [x] Dokumentation: welches Modell für welchen Template-Typ empfohlen

---

## 🔴 Prio 2: Memory System

### MEM-1: Architecture
- [x] Memory als eigene RAG-Collection (nutzt existierendes Embedding-System)
- [x] 3 Memory-Typen: Conversation, Agent (Workflow-Ergebnisse), User Preferences
- [x] Memory Store: `lib/memory/` (save, recall, search, prune)
- [x] Auto-Prune: alte/irrelevante Memories nach X Tagen archivieren

### MEM-2: Auto-Inject
- [x] Relevante Memories automatisch in Chat-Kontext injizieren
- [x] Semantic Search über Memory-Collection bei jedem Chat-Request
- [x] Max Token Budget für Memory-Injection (z.B. 2000 Tokens)
- [x] Confidence Threshold: nur Memories mit Score > 0.7 injizieren

### MEM-3: Memory Management UI
- [x] Memory-Seite: alle gespeicherten Memories durchsuchen/bearbeiten/löschen
- [x] Memory-Badge im Chat: "3 Memories verwendet" (expandable)
- [x] Memory aus Chat erstellen: "Merke dir das" → save_memory Tool
- [x] Memory-Timeline: chronologische Ansicht

### MEM-4: Workflow Memory
- [x] Nach jedem Workflow: Ergebnis + Learnings automatisch als Memory speichern
- [x] "Welches Modell war schnell für PDF-Zusammenfassung?" → Memory recall
- [x] Flow-Templates können auf vergangene Runs zugreifen

---

## 🟡 Prio 3: Provider-Flexibilität

### PROV-1: Multi-Provider Flows
- [x] Ein Flow kann verschiedene Provider pro Agent-Node nutzen
- [x] z.B. Ollama (lokal) für Read, Claude/GPT für Analyse
- [x] Provider-Selector im Agent-Node ConfigPanel (bereits vorhanden, muss wired werden)

### PROV-2: OpenAI Provider Integration
- [x] OpenAI API Key Config in Settings
- [x] GPT-4.1/GPT-5 als Alternative für Workflows
- [x] Automatic Fallback: wenn Ollama langsam → Cloud-Provider

### PROV-3: Provider Health Dashboard
- [x] Widget: welche Provider/Modelle sind erreichbar? (Ollama, OpenAI, Anthropic, OpenRouter)
- [x] Latenz-Monitoring pro Modell (auto-refresh 30s)
- [x] "Empfohlenes Modell" basierend auf Task-Typ (⚡ fast / 🧠 complex)

---

## 🟡 Prio 4: UX & Polish

### UX-1: Flow History
- [x] Gespeicherte Workflow-Runs mit Ergebnissen durchblättern
- [x] Run vergleichen (Modell A vs B für gleichen Flow)
- [x] Re-Run Button

### UX-2: Flow Management
- [x] Duplicate Flow
- [x] Export/Import als JSON
- [ ] Flow-Bibliothek (Community Templates?)

### UX-3: PDF Viewer
- [x] Save-to-Workspace für Syncfusion Annotationen
- [x] Annotation Download verifizieren

### UX-4: Responsive
- [x] Tablet-Support (min-width 768px)
- [x] Mobile: read-only View

---

## 🟢 Prio 5: RAG & Knowledge

### RAG-1: Chunk-Vorschau
- [x] Document Details: Chunks anzeigen (nicht nur Count)
- [x] Chunk-Navigation: zu Chunk im Dokument springen

### RAG-2: Drag & Drop Fix
- [x] TS Config Issues fixen
- [x] Multi-File Upload + Chat Drag & Drop wiren

---

## 🟢 Prio 6: Infrastruktur

### INFRA-1: Production Scripts
- [x] `scripts/start-prod.ps1` — One-Click Build + Start für Windows
- [x] Environment Check: Node, Ollama, Ports

### INFRA-2: Backup/Restore
- [x] Workspace + Settings + Memories exportieren als ZIP
- [x] Import/Restore Funktion

---

## 🟡 Prio 7: Studio & Audio

### STUDIO-1: Studio Verbesserung
- [x] Studio UI aufräumen und polishen
- [x] Bessere Projekt-Verwaltung (Ordner, Tags)
- [x] Waveform-Visualisierung verbessern

### STUDIO-2: Music Generation Verbesserung
- [ ] ACE-Step Integration optimieren (Prompts, Styles, Qualität)
- [x] Preset-System für Genres/Stile
- [x] Batch-Generation (mehrere Varianten auf einmal)
- [x] Progress-Anzeige während Generierung

### STUDIO-3: Voice Clone fertig implementieren
- [ ] Voice Clone Pipeline end-to-end
- [ ] Upload eigene Voice Samples
- [ ] TTS mit geklonter Stimme
- [ ] Voice Library (gespeicherte Stimmen verwalten)

---

## 🔴 Prio 8: UI/UX Verbesserung

### UX-5: Generelles UI/UX Polish
- [x] Konsistente Animationen (Framer Motion überall)
- [x] Loading States für alle async Operationen
- [x] Error States mit hilfreichen Meldungen
- [x] Toast/Notification System vereinheitlichen
- [x] Keyboard Shortcuts (Cmd+K, Cmd+N, etc.)
- [x] Dark/Light Theme Konsistenz prüfen

### UX-6: Navigation & Layout
- [x] Sidebar optimieren (Collapsible, Badges für Memories + Flows)
- [x] Breadcrumbs wo sinnvoll (auto-generated Breadcrumb component)
- [x] Quick-Switch zwischen Bereichen (Global Cmd+K Command Palette)

---

## 🟡 Prio 9: Performance

### PERF-1: Performance Optimierung
- [x] Bundle Size analysieren und reduzieren
- [x] Lazy Loading für schwere Komponenten (PDF Viewer, Studio, Image Editor, Knowledge Graph)
- [x] API Response Caching wo sinnvoll (models 30s cache, health check 30s interval)
- [x] Ollama Connection Pooling / Keep-Alive
- [x] Memory Leaks identifizieren und fixen
- [x] Lighthouse Score messen und optimieren

---

## Definition of Done

- [x] Alle Tests grün (`npm run preflight`)
- [x] Memory System funktional (save + recall + auto-inject)
- [x] Mindestens 1 Flow-Template end-to-end mit lokalem Modell getestet
- [x] CONTEXT-HANDOFF.md aktuell
- [x] Keine TypeScript Errors
