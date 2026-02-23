# Sprint 6 – Production Ready & Flow Power

**Zeitraum:** 01.03 – 14.03.2026  
**Ziel:** Workflow Engine hardenen, Memory-System einführen, Multi-Provider Support

---

## 🔴 Prio 1: Workflow Engine Hardening

### ENGINE-1: Per-Node Settings durchreichen
- [ ] Temperature + maxIterations aus AgentNodeConfig im Flow-Compiler auslesen
- [ ] `compileVisualWorkflowToPlan()` erweitern: per-Step Config in compiled Plan
- [ ] Workflow-API per-Step Config an `executeAgentLoop()` durchreichen
- [ ] UI Felder (ConfigPanel) sind bereits da (Sprint 5, commit 4a8b049)

### ENGINE-2: write_file Overwrite Default
- [ ] `write_file` Tool: Default `mode: "overwrite"` wenn File existiert
- [ ] Oder: Agent bekommt Option "overwrite" direkt im Tool-Schema

### ENGINE-3: Step-Tool-Isolation
- [ ] Agent soll Tools nur im zugewiesenen Step nutzen (Step 1 "read" soll nicht write_file callen)
- [ ] Option: `enabledTools` per Step statt global

### ENGINE-4: Flow Builder Streaming
- [ ] Live-Output im Output-Node während Workflow läuft
- [ ] Streaming-Events in der Flow-UI anzeigen (nicht nur Logs)

### ENGINE-5: Template Testing
- [ ] Alle 7 Flow-Templates mit lokalen Modellen (qwen3, phi4) durchlaufen
- [ ] Bugs fixen, Prompts optimieren
- [ ] Dokumentation: welches Modell für welchen Template-Typ empfohlen

---

## 🔴 Prio 2: Memory System

### MEM-1: Architecture
- [ ] Memory als eigene RAG-Collection (nutzt existierendes Embedding-System)
- [ ] 3 Memory-Typen: Conversation, Agent (Workflow-Ergebnisse), User Preferences
- [ ] Memory Store: `lib/memory/` (save, recall, search, prune)
- [ ] Auto-Prune: alte/irrelevante Memories nach X Tagen archivieren

### MEM-2: Auto-Inject
- [ ] Relevante Memories automatisch in Chat-Kontext injizieren
- [ ] Semantic Search über Memory-Collection bei jedem Chat-Request
- [ ] Max Token Budget für Memory-Injection (z.B. 2000 Tokens)
- [ ] Confidence Threshold: nur Memories mit Score > 0.7 injizieren

### MEM-3: Memory Management UI
- [ ] Memory-Seite: alle gespeicherten Memories durchsuchen/bearbeiten/löschen
- [ ] Memory-Badge im Chat: "3 Memories verwendet" (expandable)
- [ ] Memory aus Chat erstellen: "Merke dir das" → save_memory Tool
- [ ] Memory-Timeline: chronologische Ansicht

### MEM-4: Workflow Memory
- [ ] Nach jedem Workflow: Ergebnis + Learnings automatisch als Memory speichern
- [ ] "Welches Modell war schnell für PDF-Zusammenfassung?" → Memory recall
- [ ] Flow-Templates können auf vergangene Runs zugreifen

---

## 🟡 Prio 3: Provider-Flexibilität

### PROV-1: Multi-Provider Flows
- [ ] Ein Flow kann verschiedene Provider pro Agent-Node nutzen
- [ ] z.B. Ollama (lokal) für Read, Claude/GPT für Analyse
- [ ] Provider-Selector im Agent-Node ConfigPanel (bereits vorhanden, muss wired werden)

### PROV-2: OpenAI Provider Integration
- [ ] OpenAI API Key Config in Settings
- [ ] GPT-4.1/GPT-5 als Alternative für Workflows
- [ ] Automatic Fallback: wenn Ollama langsam → Cloud-Provider

### PROV-3: Provider Health Dashboard
- [ ] Widget: welche Provider/Modelle sind erreichbar?
- [ ] Latenz-Monitoring pro Modell
- [ ] "Empfohlenes Modell" basierend auf Task-Typ

---

## 🟡 Prio 4: UX & Polish

### UX-1: Flow History
- [ ] Gespeicherte Workflow-Runs mit Ergebnissen durchblättern
- [ ] Run vergleichen (Modell A vs B für gleichen Flow)
- [ ] Re-Run Button

### UX-2: Flow Management
- [ ] Duplicate Flow
- [ ] Export/Import als JSON
- [ ] Flow-Bibliothek (Community Templates?)

### UX-3: PDF Viewer
- [ ] Save-to-Workspace für Syncfusion Annotationen
- [ ] Annotation Download verifizieren

### UX-4: Responsive
- [ ] Tablet-Support (min-width 768px)
- [ ] Mobile: read-only View

---

## 🟢 Prio 5: RAG & Knowledge

### RAG-1: Chunk-Vorschau
- [ ] Document Details: Chunks anzeigen (nicht nur Count)
- [ ] Chunk-Navigation: zu Chunk im Dokument springen

### RAG-2: Drag & Drop Fix
- [ ] TS Config Issues fixen
- [ ] Multi-File Upload + Chat Drag & Drop wiren

---

## 🟢 Prio 6: Infrastruktur

### INFRA-1: Production Scripts
- [ ] `scripts/start-prod.ps1` — One-Click Build + Start für Windows
- [ ] Environment Check: Node, Ollama, Ports

### INFRA-2: Backup/Restore
- [ ] Workspace + Settings + Memories exportieren als ZIP
- [ ] Import/Restore Funktion

---

## Definition of Done

- [ ] Alle Tests grün (`npm run preflight`)
- [ ] Memory System funktional (save + recall + auto-inject)
- [ ] Mindestens 1 Flow-Template end-to-end mit lokalem Modell getestet
- [ ] CONTEXT-HANDOFF.md aktuell
- [ ] Keine TypeScript Errors
