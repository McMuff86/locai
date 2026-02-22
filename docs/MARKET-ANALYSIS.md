# LocAI — Marktanalyse, Zielgruppen & Vermarktung

> Analyse vom 21.02.2026

---

## Was LocAI ist

Ein **Self-Hosted AI Workspace** der Chat, Flow Builder, Document Management, Image Editor, Terminal, Notes, Knowledge Graph, Gallery und Music/TTS in einer App vereint. Lokal-first, Multi-Provider (Ollama + Cloud), kein Vendor Lock-in.

---

## Zielgruppen

### 🎯 Primäre Zielgruppen

**1. Technik-affine Power User / Maker**
- Entwickler, Engineers, Kreative die AI produktiv nutzen wollen
- Haben eigene GPU, kennen sich mit Self-Hosting aus
- Wollen keine Daten in die Cloud schicken
- Nutzen mehrere AI-Tools und wollen alles an einem Ort

**2. Kleine Teams / Agenturen (3-15 Leute)**
- Design-Agenturen, Architektur-Büros, Content-Creator
- Brauchen: Chat + Bildgenerierung + Dokumente + Workflows
- Zahlen ungern 5 SaaS-Abos à $20-50/Monat pro Person
- Self-Hosted auf einem Team-Server = einmalige Kosten

**3. Datenschutz-sensible Branchen**
- Anwälte, Ärzte, Finanz, Behörden (DSGVO, Schweizer Datenschutz)
- Dürfen keine Dokumente an OpenAI/Anthropic schicken
- Ollama lokal = Compliance out of the box
- **Starkes Verkaufsargument in der Schweiz/EU**

**4. AI Educators / Workshop-Leiter**
- Flow Builder = visuelles Lehrmittel für AI-Workflows
- "Bau dir deinen eigenen AI-Agent" als Workshop
- Self-contained, kein Cloud-Account nötig

### ❌ Weniger geeignet für
- Nicht-technische Endanwender (Setup-Hürde: Ollama, GPU, Docker)
- Enterprise (fehlt: User Management, SSO, Audit Logs)
- Mobile-only User

---

## Stärken / Unique Selling Points

### 🏆 1. All-in-One (grösste Stärke)
Kein anderes Open-Source Tool kombiniert **Chat + Flow Builder + Documents + Image Editor + TTS + Music + Terminal + Knowledge Graph** in einer App. Die Konkurrenz:
- **Open WebUI** = nur Chat
- **Langflow/Flowise** = nur Flows
- **AnythingLLM** = Chat + RAG, kein Flow Builder
- **LibreChat** = Multi-Provider Chat, kein Workspace

LocAI ist das **Schweizer Taschenmesser** für lokale AI.

### 🏆 2. Lokal-First + Multi-Provider
- Ollama für Datenschutz, Cloud-Provider für Power
- **Kein Entweder-Oder** — beides in derselben App, pro Node wählbar
- Flow Builder: Node A mit Llama3 lokal, Node B mit Claude → Hybrid

### 🏆 3. Flow Builder mit echtem Execution Engine
- Nicht nur visuell, sondern **läuft tatsächlich** (DAG Execution, Persistence, Resume)
- Control Flow, Loops, Conditions — das haben die meisten visuellen Tools nicht
- Templates für gängige Workflows (PDF Summary, etc.)

### 🏆 4. Eigenes Package-Ökosystem
- `@mcmuff86/pdf-core`, `ace-step-client`, `qwen3-tts-client`
- Modular, austauschbar, wiederverwendbar
- Zeigt Engineering-Qualität die über ein Hobby-Projekt hinausgeht

---

## Feature Gaps

### Must-Have für Vermarktung

| Feature | Warum | Aufwand |
|---------|-------|---------|
| **One-Click Install / Docker Compose** | Setup ist aktuell zu komplex für Nicht-Devs | Mittel |
| **User Management** (Multi-User, Rollen) | Für Teams unverzichtbar | Gross |
| **Mobile-Responsive UI** | Aktuell Desktop-only | Mittel |
| **Plugin System** | Community kann eigene Nodes/Tools bauen | Gross |
| **Embedding/RAG verbessern** | Document Q&A muss zuverlässig funktionieren | Mittel |
| **Auto-Start Services** | Ollama, ACE-Step, TTS automatisch starten/checken | Klein |

### Nice-to-Have (Differenzierung)

| Feature | Warum |
|---------|-------|
| **Collaborative Editing** | Mehrere User am gleichen Flow/Doc |
| **Marketplace für Flow Templates** | Community teilt Workflows |
| **Webhook/API Triggers** | Flows von extern starten (Zapier-Alternative) |
| **Scheduled Flows** | Cron-basierte Automatisierung |
| **Voice Chat** | Qwen3-TTS + Whisper = Sprachassistent |
| **Canvas/Whiteboard Mode** | Visuelles Brainstorming mit AI |

---

## Vermarktungsoptionen

### Option A: Open Source + Hosted Version (SaaS)
```
LocAI Community (gratis, self-hosted)
LocAI Pro ($15-29/Monat, gehostet, Multi-User, Support)
LocAI Team ($49-99/Monat, SSO, Admin, Priority Support)
```
→ Open-Core Modell wie Gitea/Minio/n8n

### Option B: Nischen-Produkt für Schweizer/EU Markt
- DSGVO-konformer AI-Workspace
- Verkauf an KMU: "AI nutzen ohne Cloud"
- Managed Installation auf Kunden-Server
- CHF 500-2000 Setup + CHF 50-200/Monat Support
- **Renato (Bucher) könnte erster Kunde sein** — ERP + AI Workspace Bundle

### Option C: Template/Extension Marketplace
- LocAI gratis, Geld mit Premium-Templates und Integrationen
- Flow Templates für spezifische Branchen (Architektur, Schreinerei, Legal)
- Funktioniert erst mit genug Community

### Option D: Workshop/Education
- "Baue deinen eigenen AI-Workspace" Kurs
- CHF 500-1500 pro Workshop
- LocAI als Plattform, du als Instructor

---

## Einschätzung

**Kurzfristig (3-6 Monate):** Option B ist am realistischsten. Schweizer KMU die AI wollen aber keine Daten rausgeben. Branchenkenntnis (Schreinerei, Metallbau) ist vorhanden, Tech-Stack steht, potenzieller Erstkunde (Renato) existiert.

**Mittelfristig (6-12 Monate):** Option A parallel aufbauen. Docker-Image, Docs, Landing Page, GitHub Stars sammeln. Open Source Community aufbauen.

**Killer-Kombi:** DriftERP + LocAI zusammen verkaufen. "ERP für deinen Betrieb + AI-Workspace für dein Team". Das hat niemand anders.

---

## Wo der meiste Nutzen liegt

1. **Flow Builder** — Der Star. Visuelle AI-Workflows die jeder versteht und anpassen kann. Kein Code nötig. Das ist was Unternehmen wollen.

2. **Document AI** (PDF + RAG) — "Lade deine Baupläne hoch, stell Fragen" — sofort greifbarer Nutzen für jedes KMU.

3. **Lokal + Datenschutz** — In der Schweiz/EU ein echtes Argument. Nicht "nice to have" sondern Compliance-Pflicht.

4. **Multi-Provider** — Kunden starten mit Ollama (gratis), upgraden auf Claude/GPT wenn sie merken dass sie mehr Power brauchen. Keine Migration nötig.

---

*Erstellt: 21.02.2026 | Brainstorming Session Adi + Sentinel*
