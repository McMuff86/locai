# LocAI — Package Integration & Performance Plan

> Brainstorming vom 21.02.2026. Umsetzungsplan für Package-Integration, Performance und Bug Fixes.

---

## 1. Performance — Ladezeiten verbessern

### 1.1 Dynamic Imports / Lazy Loading (Prio 1 🔥🔥🔥)

Schwere Komponenten werden aktuell vermutlich im Initial Bundle geladen. Mit `next/dynamic` + `ssr: false` nur laden wenn die Route besucht wird.

**Betroffene Komponenten:**
- **Flow Builder** (`@xyflow/react`) — nur auf `/flow`
- **Knowledge Graph** (`react-force-graph` + Three.js, ~500KB+) — nur auf `/notes/graph`
- **Terminal** (`@xterm/xterm` + `node-pty`) — nur auf `/terminal`
- **Image Editor** (Canvas API, heavy) — nur wenn Datei geöffnet
- **PDF Viewer** (`@mcmuff86/pdf-core` + `pdfjs-dist`, ~300KB) — nur wenn PDF geöffnet
- **Gallery** (Three.js Lightbox) — nur auf `/gallery`

**Beispiel:**
```tsx
import dynamic from 'next/dynamic';

const FlowCanvas = dynamic(() => import('@/components/flow/FlowCanvas'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});
```

**Erwarteter Impact:** Initial Bundle 50-70% kleiner, First Load 2-3x schneller.

### 1.2 Bundle Analyse (Prio 6)

```bash
npx @next/bundle-analyzer
```

Identifiziere die grössten Chunks und optimiere gezielt.

### 1.3 React Server Components

Prüfen ob Pages bereits RSC nutzen oder ob alles `"use client"` ist. Server Components reduzieren Client-JS massiv.

### 1.4 IndexedDB Hydration

Zustand + IndexedDB kann langsam sein beim Start. Lazy Hydration für Stores die nicht sofort sichtbar sind (z.B. Flow-State, Gallery-State).

### 1.5 API Route Consolidation

21 API-Verzeichnisse. Prüfen ob verwandte Routes zusammengefasst werden können um Cold-Start-Overhead zu reduzieren.

### 1.6 Production Build für Daily Use

`npm run dev` ist immer langsamer als Production. Für tägliche Nutzung:
```bash
npm run build && npm start
```

---

## 2. Package-Integration

### 2.1 Bestehendes Ökosystem

| Package | Repo | Status | Port |
|---------|------|--------|------|
| `@mcmuff86/pdf-core` | McMuff86/pdf-core | ✅ In LocAI | — |
| `@mcmuff86/ace-step-client` | McMuff86/ace-step-client | ✅ Erstellt | ACE-Step API: 8001 |
| `@mcmuff86/qwen3-tts-client` | McMuff86/qwen3-tts-client | ✅ Erstellt | Qwen3-TTS API: 7862 |

### 2.2 ACE-Step Integration (Music Generation)

**Install:**
```bash
npm install @mcmuff86/ace-step-client
# oder als Git-Dependency:
npm install github:McMuff86/ace-step-client
```

**next.config.ts:**
```ts
const nextConfig: NextConfig = {
  transpilePackages: ['@mcmuff86/pdf-core', '@mcmuff86/ace-step-client'],
};
```

**Neue API Routes:**
```
src/app/api/music/
├── generate/route.ts    — POST: Submit generation job
├── status/route.ts      — POST: Poll job status
├── download/route.ts    — GET: Download audio file
└── health/route.ts      — GET: ACE-Step server health
```

**Neuer Flow Node: `MusicNode`**
```
src/components/flow/nodes/MusicNode.tsx
```
- Inputs: Caption (style tags), Lyrics, Duration, BPM
- Output: Audio file path
- Config: Task type (caption/description), batch size
- Runtime Badge: zeigt Generation-Progress

**Chat Agent Tool:**
```typescript
// src/lib/agents/tools/generate_music.ts
{
  name: "generate_music",
  description: "Generate a song with ACE-Step 1.5",
  parameters: {
    caption: "Style tags (genre, mood, instruments, vocals)",
    lyrics: "Song lyrics with structure tags [Verse], [Chorus], etc.",
    duration: "Duration in seconds (10-480)",
    bpm: "Tempo (30-300)",
  }
}
```

**Optional: Music Page**
```
src/app/(app)/music/page.tsx
```
- Dedizierte UI für Musikgenerierung
- Caption Builder (Genre/Mood/Instruments Selektoren)
- Lyrics Editor mit Structure-Tag Buttons
- Audio Player mit Waveform
- History der generierten Songs

### 2.3 Qwen3-TTS Integration (Voice Clone / TTS)

**Voraussetzung:** FastAPI Server im qwen3-tts_voice_clone Repo (PR auf `feat/fastapi-server` Branch, Port 7862).

**Install:**
```bash
npm install @mcmuff86/qwen3-tts-client
# oder:
npm install github:McMuff86/qwen3-tts-client
```

**next.config.ts:** Zu `transpilePackages` hinzufügen.

**Neue API Routes:**
```
src/app/api/tts/
├── clone/route.ts       — POST: Voice cloning (multipart)
├── custom/route.ts      — POST: Custom voice (built-in speakers)
├── design/route.ts      — POST: Voice design (natural language)
├── transcribe/route.ts  — POST: Transcribe audio
├── voices/route.ts      — GET: List voice templates
├── speakers/route.ts    — GET: List available speakers
└── health/route.ts      — GET: TTS server health
```

**Neuer Flow Node: `TTSNode`**
```
src/components/flow/nodes/TTSNode.tsx
```
- Inputs: Text, Voice Template / Speaker
- Output: Audio file
- Config: Language, Model Size, Clone vs Custom vs Design
- Voice Dropdown mit Preview-Button

**Chat Integration:**
- TTS Button (🔊) bei jeder AI-Antwort → "Vorlesen" mit gewählter Stimme
- Voice Selector in Settings: Default-Stimme wählen

**Chat Agent Tool:**
```typescript
// src/lib/agents/tools/text_to_speech.ts
{
  name: "text_to_speech",
  description: "Convert text to speech with Qwen3-TTS",
  parameters: {
    text: "Text to speak",
    language: "Language (German, English, etc.)",
    speaker: "Speaker name or 'clone' for voice clone",
    voice_template: "Path to voice template (for clone mode)",
  }
}
```

**Voice Management in Settings:**
```
src/app/(app)/settings/ → neuer Tab "Voice"
```
- Voice aufnehmen (MediaRecorder API) → als Template speichern
- Voice Templates verwalten (list, preview, delete)
- Default Voice für TTS setzen
- API Key / Server URL konfigurieren

### 2.4 Settings Updates

Neuer Settings-Bereich für externe Services:

```typescript
// src/lib/settings/types.ts — erweitern
interface ExternalServices {
  aceStep: {
    enabled: boolean;
    url: string;      // default "http://localhost:8001"
    timeout: number;  // default 300000
  };
  qwenTTS: {
    enabled: boolean;
    url: string;      // default "http://localhost:7862"
    timeout: number;  // default 120000
    defaultSpeaker: string;
    defaultLanguage: string;
    defaultModelSize: "0.6B" | "1.7B";
  };
}
```

---

## 3. Flow Builder — PDF Template Bug Fix (Qwen3)

### Problem
Das PDF-Zusammenfassung Template funktioniert nicht mit Qwen3. Mögliche Ursachen:

1. **Hardcoded `model: 'llama3'`** im Template (registry.ts) — Qwen3 wird nicht korrekt an den Agent Node übergeben
2. **Tool Calling Format** — Qwen3 hat ein anderes Tool-Call Format als Llama3
3. **Ollama Response Parsing** — Streaming-Responses von Qwen3 werden evtl. anders geparst
4. **Prompt Template** — Qwen3 braucht evtl. andere System Prompts

### Debug-Schritte
1. Flow mit Qwen3 starten, Error aus Browser Console / Terminal loggen
2. Prüfen ob der Agent Node das richtige Modell bekommt (Provider + Model)
3. Ollama API direkt testen: `curl http://localhost:11434/api/chat -d '{"model":"qwen3","messages":[...]}'`
4. Tool-Call Response-Format vergleichen (Llama3 vs Qwen3)

### Fix-Ansatz
- Template Model auf `null` oder konfigurierbar setzen (User wählt Model im Node)
- Ollama Provider: Qwen3-spezifisches Response-Parsing einbauen falls nötig
- Flow Engine: Model-Override pro Node muss korrekt durchgereicht werden

---

## 4. Umsetzungs-Reihenfolge

| Phase | Task | Impact | Aufwand |
|-------|------|--------|---------|
| **A** | Performance: Dynamic Imports für alle schweren Komponenten | 🔥🔥🔥 | 1 Session |
| **B** | Flow PDF Bug fixen (Qwen3 kompatibel) | 🔥🔥 | 1 Session |
| **C** | ACE-Step in LocAI integrieren (API Routes + Flow Node + Agent Tool) | 🔥🔥 | 1-2 Sessions |
| **D** | Qwen3-TTS in LocAI integrieren (API Routes + Flow Node + Chat TTS + Agent Tool) | 🔥🔥 | 1-2 Sessions |
| **E** | Settings UI für External Services | 🔥 | 1 Session |
| **F** | Optional: Music Page UI, Voice Management UI | 🔥 | 1-2 Sessions |
| **G** | Bundle Analyse + weitere Performance-Optimierungen | 🔥 | 1 Session |

### Abhängigkeiten
```
A (Performance) ─── keine Deps, kann sofort starten
B (PDF Bug) ─────── keine Deps, kann sofort starten
C (ACE-Step) ────── benötigt: ace-step-client Package ✅
D (Qwen3-TTS) ───── benötigt: qwen3-tts-client Package ✅ + FastAPI Server (PR mergen)
E (Settings) ────── sollte vor/mit C+D gemacht werden
F (UIs) ─────────── nach C+D
G (Bundle) ──────── nach A
```

**Empfehlung:** A + B parallel starten, dann C + D + E als nächster Block.

---

## 5. Architektur-Übersicht (nach Integration)

```
LocAI (Next.js)
├── Chat ──────────── Agent Tools: generate_music, text_to_speech
├── Flow Builder ──── MusicNode, TTSNode, AgentNode, TemplateNode, ...
├── Documents ─────── PDF Viewer (@mcmuff86/pdf-core)
├── Settings ──────── Provider Config + External Services Config
│
├── API Routes
│   ├── /api/chat ────── Ollama / Anthropic / OpenAI / OpenRouter
│   ├── /api/music ───── @mcmuff86/ace-step-client → localhost:8001
│   ├── /api/tts ─────── @mcmuff86/qwen3-tts-client → localhost:7862
│   └── /api/pdf ─────── @mcmuff86/pdf-core
│
└── External Services (localhost)
    ├── Ollama ─────── :11434 (LLM)
    ├── ACE-Step ───── :8001  (Music Generation)
    ├── Qwen3-TTS ──── :7862  (Voice Clone / TTS)
    └── ComfyUI ────── :8188  (Image Generation)
```

---

*Erstellt: 21.02.2026 | Basierend auf Brainstorming Session mit Sentinel*
