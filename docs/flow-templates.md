# Flow Templates

Übersicht der vorkonfigurierten Flow-Templates in LocAI.

## Modell-Empfehlungen

| Tier | Modelle | Einsatz |
|------|---------|---------|
| ⚡ Schnell | `qwen3:1.7b`, `phi4-mini` | Einfache Tasks, Formatierung, kurze Prompts |
| 🧠 Standard | `qwen3:8b`, `phi4` | Allgemeine Aufgaben, Reviews, Zusammenfassungen |
| 💪 Komplex | `qwen3:30b-a3b`, `gemma3:27b` | Multi-Step-Analyse, Code-Review, Research |

---

## Templates

### 1. Default (`default`)

**Beschreibung:** Minimaler Flow — Input → Agent → Output.

- **Nodes:** 3 (Input, Agent, Output)
- **Steps:** 1
- **Empfohlenes Modell:** ⚡ bis 🧠 (je nach Task)
- **Input:** Beliebiger Text-Prompt
- **Output:** Agent-Antwort
- **Limitationen:** Kein Multi-Step, keine Verzweigungen

---

### 2. PDF Verarbeitung (`pdf-processing`)

**Beschreibung:** PDF lesen → Formatieren → Analysieren → Ergebnis.

- **Nodes:** Input, Read-Agent, Format-Template, Analyse-Agent, Output
- **Steps:** ~3–4
- **Empfohlenes Modell:** 🧠 Standard (Textverarbeitung)
- **Input:** PDF-Datei oder extrahierter Text
- **Output:** Analysierter/formatierter Inhalt
- **Limitationen:** PDF-Extraktion muss vorab erfolgen (kein nativer PDF-Parser)

---

### 3. Excel Verarbeitung (`excel-processing`)

**Beschreibung:** Excel lesen → Formatieren → Datenanalyse → Ergebnis.

- **Nodes:** Input, Read-Agent, Format-Template, Analyse-Agent, Output
- **Steps:** ~3–4
- **Empfohlenes Modell:** 🧠 Standard
- **Input:** Excel/CSV-Daten
- **Output:** Analyse-Ergebnis mit Daten-Insights
- **Limitationen:** Grosse Tabellen können Token-Limits überschreiten

---

### 4. Web Research (`web-research`)

**Beschreibung:** Web-Suche → Analyse mit Quellenbewertung → Ergebnis.

- **Nodes:** Input, Search-Agent, Analyse-Agent/Template, Output
- **Steps:** ~3–4
- **Empfohlenes Modell:** 💪 Komplex (Quellenbewertung braucht Reasoning)
- **Input:** Recherche-Frage
- **Output:** Recherche-Ergebnis mit Quellenangaben
- **Limitationen:** Erfordert `web_search` Tool; Qualität hängt von Suchresultaten ab

---

### 5. Code Review (`code-review`)

**Beschreibung:** Datei lesen → Review → Condition → Fixes oder OK.

- **Nodes:** Input, Read-Agent, Review-Template, Review-Agent, **Condition**, Fix-Agent, Output-True, Output-False
- **Steps:** ~5–6 (inkl. Condition-Step)
- **Empfohlenes Modell:** 💪 Komplex
- **Input:** Code-Datei oder Code-Snippet
- **Output:** Review-Ergebnis mit optionalen Fix-Vorschlägen
- **Besonderheit:** Enthält **Condition-Node** — verzweigt je nach Review-Ergebnis (Issues gefunden → Fixes, OK → direkte Ausgabe)
- **Limitationen:** Condition-Evaluation braucht LLM-Call; grosse Dateien können Kontext sprengen

---

### 6. Content Creation (`content-creation`)

**Beschreibung:** Recherche → Outline → Schreiben → SEO-Check → Artikel.

- **Nodes:** Input, Research-Agent, Outline-Template, Write-Agent, SEO-Agent, Output
- **Steps:** ~4–5
- **Empfohlenes Modell:** 💪 Komplex (Multi-Step-Pipeline)
- **Input:** Thema/Briefing
- **Output:** Fertiger Artikel mit SEO-Optimierung
- **Limitationen:** Lange Pipeline; jeder Step baut auf vorherigem auf — Fehler propagieren

---

### 7. Musik generieren (`music-generation`)

**Beschreibung:** Beschreibung → Prompt → Musik generieren → Ergebnis.

- **Nodes:** Input, Prompt-Agent, Generate-Agent/Template, Output
- **Steps:** ~2–3
- **Empfohlenes Modell:** ⚡ bis 🧠 (Prompt-Generierung ist relativ einfach)
- **Input:** Musik-Beschreibung (Genre, Stimmung, etc.)
- **Output:** Generierter Musik-Prompt / Audio-Output
- **Limitationen:** Abhängig von externem Musik-Modell/API

---

### 8. Data Pipeline (`data-pipeline`)

**Beschreibung:** Datei lesen → Transformieren → Validieren → Speichern.

- **Nodes:** Input, Read-Agent, Transform-Template, Transform-Agent, **Condition**, Write-Agent, Output-True, Output-False
- **Steps:** ~5–6 (inkl. Condition-Step)
- **Empfohlenes Modell:** 🧠 Standard bis 💪 Komplex
- **Input:** Daten-Datei (CSV, JSON, etc.)
- **Output:** Transformierte und validierte Daten
- **Besonderheit:** Enthält **Condition-Node** — Validierung entscheidet ob Daten gespeichert oder abgelehnt werden
- **Limitationen:** Grosse Datenmengen können Token-Limits erreichen

---

## Validierung

Templates können programmatisch validiert werden:

```typescript
import { validateTemplate } from '@/lib/flow/validateTemplate';

const result = validateTemplate('code-review');
// { valid: true, errors: [], warnings: [] }
```

Geprüft wird:
- Alle Nodes verbunden (keine Orphans)
- Mindestens 1 Agent/Template-Node
- Output-Node vorhanden
- Input-Node vorhanden
- Keine doppelten Node-IDs
- Edges referenzieren existierende Nodes
