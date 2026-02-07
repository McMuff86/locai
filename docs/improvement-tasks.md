# LocAI – Improvement Tasks

> Erstellt: 2026-02-04 (Nightly Analyse)
> Branch: `nightly/04-02-2026`
> Baseline: Commit `08efe40` (main)

---

## Zusammenfassung

LocAI ist ein solides lokales AI-Chat-Projekt mit Next.js 15, TypeScript und Ollama-Integration. Die Codebase ist gut strukturiert (Gallery und Notes bereits refactored), hat CI/CD via GitHub Actions und grundlegendes API-Hardening. 

Hauptbereiche für Verbesserungen:
1. **Lint-Warnings aufräumen** (Quick Wins)
2. **Security Lücken** in mehreren API Routes
3. **Testabdeckung** stark ausbaubar (nur 20 Tests für pure libs)
4. **Error Handling** inkonsistent
5. **Architektur**: Einige Patterns modernisierbar

---

## 🔴 Hoch – Security

### SEC-1: Fehlende Security-Checks auf API Routes
**Beschreibung:** `assertLocalRequest()` wird nur in `/api/gpu/kill-process` und `/api/comfyui/launch` verwendet. Folgende Routes haben **keinen** Security-Check:
- `/api/system-stats` – Gibt CPU, RAM, GPU, laufende Prozesse preis
- `/api/comfyui/gallery` – Listet Dateien auf dem Filesystem
- `/api/comfyui/gallery/[id]` – Liefert Dateien direkt aus
- `/api/comfyui/gallery/metadata` – Liest Datei-Metadaten
- `/api/comfyui/gallery/delete` – **Löscht Dateien** ohne Auth!
- `/api/comfyui/gallery/copy-to-input` – Kopiert Dateien
- `/api/notes/*` – CRUD auf Filesystem-Notizen
- `/api/settings` – Liest/schreibt App-Einstellungen
- `/api/search/*` – Web-Suche
- `/api/folder-picker` – Öffnet OS-Dialog
- `/api/ollama/pull` – Kann Models runterladen

**Priorität:** 🔴 Hoch
**Aufwand:** 2-3h
**Fix:** `assertLocalRequest()` als Middleware oder in jede Route einfügen. Am besten als Next.js Middleware (`middleware.ts`) für alle `/api/*` Routes.

### SEC-2: Path Traversal in Gallery/Notes Routes
**Beschreibung:** Die Gallery-Route akzeptiert `outputPath` als Query-Parameter und liest direkt vom Filesystem. Keine Validierung gegen Path Traversal (z.B. `../../etc/passwd`). Gleiches Problem bei Notes mit `basePath`.
**Priorität:** 🔴 Hoch
**Aufwand:** 2h
**Fix:** Pfade gegen eine Allowlist oder ein Basis-Verzeichnis normalisieren und validieren. `path.resolve()` + check ob resolved path mit erlaubtem Prefix beginnt.

### SEC-3: ComfyUI Launch – Command Injection Risiko
**Beschreibung:** `/api/comfyui/launch` nutzt `spawn()` mit `shell: true` und akzeptiert `comfyUIPath` aus dem Request Body. Zwar wird der Pfad mit `path.normalize()` behandelt, aber `shell: true` macht Command Injection möglich.
**Priorität:** 🔴 Hoch
**Aufwand:** 1h
**Fix:** `shell: false` verwenden oder Pfad strenger validieren (keine Shell-Metazeichen erlauben).

---

## 🟡 Mittel – Code-Qualität

### CQ-1: Lint Warnings aufräumen
**Beschreibung:** 18+ Lint Warnings:
- 5x unused imports/vars (`ChatResponse`, `MessageContent`, `MessageImageContent`, `isLoadedConversationRef`, `altPattern`, `parseError`)
- 3x `any` types (`useWebSearch.ts`, `templates/index.ts`, `searxng.ts`)
- 2x `let` → `const` (`images` in `ollama.ts`)
- 2x `@ts-ignore` → `@ts-expect-error` (`storage.ts`)
- 1x missing React Hook dependency (`useSettings.ts`)

**Priorität:** 🟡 Mittel
**Aufwand:** 30min
**Fix:** Systematisch durchgehen, unused imports entfernen, Types hinzufügen.

### CQ-2: Duplicate Code in ollama.ts (sendChatMessage vs sendStreamingChatMessage)
**Beschreibung:** Die Message-Formatting-Logik (Vision-Model Check, Image-Extraktion) ist in beiden Funktionen (~80 Zeilen) dupliziert.
**Priorität:** 🟡 Mittel
**Aufwand:** 1h
**Fix:** `formatMessagesForApi()` Hilfsfunktion extrahieren, die beide nutzen.

### CQ-3: Console.log Statements in Production Code
**Beschreibung:** Viele `console.log()` / `console.error()` direkt im Code, z.B.:
- `ollama.ts`: "Sending chat request with payload:" loggt den gesamten Request inkl. Base64-Bilder
- `embeddings.ts`: Verbose Logging bei jedem Chunk
- Diverse API Routes

**Priorität:** 🟡 Mittel
**Aufwand:** 2h
**Fix:** Logger-Utility einführen mit Log-Levels (debug/info/warn/error). `console.log` mit Payload-Dumps entfernen – besonders das in `sendChatMessage` das riesige Base64-Strings loggt.

### CQ-4: ConversationSidebar Refactoring (543 Zeilen)
**Beschreibung:** Die größte verbleibende Komponente. Enthält: Brand/Logo, Search, Ollama Status, ComfyUI Widget, Gallery Link, Notes Link, Tag Filter, Stats Panel, Conversation List, Import/Export Actions. Das ist zu viel Verantwortung.
**Priorität:** 🟡 Mittel
**Aufwand:** 3-4h
**Fix:** In Sub-Komponenten aufteilen:
- `SidebarHeader.tsx` (Logo, New Chat, Search)
- `SidebarTools.tsx` (Ollama Status, ComfyUI, Links)
- `ConversationList.tsx` (Filter, Cards, Stats)
- `SidebarFooter.tsx` (Import/Export)

### CQ-5: package.json Name ist "mc_agent" statt "locai"
**Beschreibung:** Der Paketname ist noch `mc_agent`, sollte `locai` sein.
**Priorität:** 🟡 Mittel (Cosmetic, aber verwirrend)
**Aufwand:** 5min

### CQ-6: Hardcoded Strings / fehlende i18n-Vorbereitung
**Beschreibung:** Alle UI-Strings sind hardcoded auf Deutsch (z.B. "Neuer Chat", "Bildkonversation", "Chat-Verlauf", etc.). Für eine SaaS-Zukunft problematisch.
**Priorität:** 🟢 Niedrig (derzeit kein i18n nötig)
**Aufwand:** 4-6h für Grundstruktur
**Fix:** String-Konstanten in Dateien auslagern. next-intl oder i18next bei Bedarf.

---

## 🟡 Mittel – Tests

### TEST-1: API Route Tests fehlen komplett
**Beschreibung:** Alle 15+ API Routes haben null Testabdeckung. Das sind die kritischsten Codepfade (Security, Filesystem-Ops, externe Calls).
**Priorität:** 🟡 Mittel
**Aufwand:** 6-8h
**Fix:** Vitest + `next/test-utils` oder eigene Mocks. Priorität:
1. `/api/gpu/kill-process` (Security + Destructive)
2. `/api/comfyui/gallery/delete` (Destructive)
3. `/api/notes` (CRUD)
4. `/api/_utils/security.ts` (assertLocalRequest Tests)

### TEST-2: Hook Tests fehlen
**Beschreibung:** Die Custom Hooks (`useChat`, `useConversations`, `useModels`, etc.) haben keine Tests.
**Priorität:** 🟡 Mittel
**Aufwand:** 4-6h
**Fix:** `@testing-library/react-hooks` (oder Vitest + jsdom) für Hook-Tests. Priorität: `useConversations` (localStorage logic), `useChat` (message flow).

### TEST-3: Storage.ts hat keine Tests
**Beschreibung:** `storage.ts` (389 Zeilen) enthält die komplette localStorage-Logik inkl. Quota-Handling, Image-Compression, Import/Export – alles ungetestet.
**Priorität:** 🟡 Mittel
**Aufwand:** 3h
**Fix:** Mock `localStorage`, test Quota-Fallback, Image-Placeholder-Logik.

---

## 🟡 Mittel – Performance

### PERF-1: Gallery scannt Filesystem bei jedem Request
**Beschreibung:** `/api/comfyui/gallery` scannt das Output-Verzeichnis rekursiv (`scanDirectory()`) bei jedem GET. Bei vielen Bildern (1000+) wird das langsam.
**Priorität:** 🟡 Mittel
**Aufwand:** 3-4h
**Fix:** In-Memory Cache mit File-Watcher (`fs.watch`) oder Timestamp-basiertes Invalidation. Oder: Index-Datei wie bei Notes.

### PERF-2: CPU Usage Polling blockiert für 100ms
**Beschreibung:** `getCpuUsage()` in `system-stats` nutzt `setTimeout(resolve, 100)` – blockiert den Response um 100ms. Bei häufigem Polling (z.B. jede Sekunde) ist das ok, aber unnötig blockierend.
**Priorität:** 🟢 Niedrig
**Aufwand:** 30min
**Fix:** Cache CPU-Stats für 1-2 Sekunden. Oder: WebSocket/SSE statt Polling.

### PERF-3: Embeddings werden sequentiell generiert
**Beschreibung:** `upsertEmbeddingsForNote()` verarbeitet Chunks streng sequentiell (for-loop mit await). Bei vielen Chunks dauert das lang.
**Priorität:** 🟢 Niedrig
**Aufwand:** 1h
**Fix:** Batch mit kontrollierter Parallelität (z.B. `Promise.allSettled` mit Concurrency-Limit von 3-5).

---

## 🟡 Mittel – Architektur

### ARCH-1: Keine zentrale Error-Handling-Strategie in API Routes
**Beschreibung:** Jede API Route hat eigenes try/catch mit inkonsistenten Error-Responses. Manche geben `{ error: "..." }`, andere `{ success: false, error: "..." }`. Status Codes variieren.
**Priorität:** 🟡 Mittel
**Aufwand:** 2-3h
**Fix:** Error-Utility erstellen:
```ts
// lib/api-utils.ts
export function apiError(message: string, status: number, details?: object) {
  return NextResponse.json({ success: false, error: message, ...details }, { status });
}
export function apiSuccess(data: object) {
  return NextResponse.json({ success: true, ...data });
}
```

### ARCH-2: Ollama Host Resolution ist verstreut
**Beschreibung:** Die Ollama-Host-Auflösung existiert in mehreren Varianten:
- `ollama.ts`: `resolveOllamaHost()` (mit localStorage + env + default)
- `system-stats/route.ts`: Eigener `sanitizeHost()` + Query-Param
- `notes/ai/route.ts`: `body.host || DEFAULT_HOST`
- `search/route.ts`: `options.ollamaHost || 'http://localhost:11434'`

**Priorität:** 🟡 Mittel
**Aufwand:** 2h
**Fix:** Zentrale Server-Side Host-Resolution in einer shared Utility.

### ARCH-3: Fehlende .env.example
**Beschreibung:** Es gibt keine `.env.example` Datei, obwohl der Code mehrere Environment Variables unterstützt: `LOCAI_API_TOKEN`, `LOCAI_ALLOW_REMOTE`, `LOCAL_NOTES_PATH`, `NEXT_PUBLIC_OLLAMA_URL`.
**Priorität:** 🟡 Mittel
**Aufwand:** 15min

### ARCH-4: Supabase Dependency ohne Nutzung
**Beschreibung:** `supabase` ist als devDependency installiert und es gibt `supabase/config.toml`, aber nirgends wird Supabase tatsächlich genutzt. Das erhöht install-Größe und verwirrt.
**Priorität:** 🟢 Niedrig
**Aufwand:** 10min
**Fix:** Entweder nutzen (geplant laut Agents.md) oder entfernen bis es gebraucht wird.

---

## 🟡 Mittel – Dokumentation

### DOC-1: Agents.md ist veraltet
**Beschreibung:** `Agents.md` hat `Last Updated: 2025-12-08` – knapp 2 Monate alt. Die Versionen in der Tech-Stack-Tabelle (z.B. Next.js 15.5.7, React 19.2.1) stimmen nicht mit `package.json` überein (React 19.0.0, Next 15.5.7 war korrekt).
**Priorität:** 🟡 Mittel
**Aufwand:** 30min

### DOC-2: README.MD hat falsche Clone-URL
**Beschreibung:** `git clone https://github.com/yourusername/locai.git` – Placeholder nicht ersetzt.
**Priorität:** 🟡 Mittel (verwirrt Contributors)
**Aufwand:** 5min

### DOC-3: Keine API-Dokumentation
**Beschreibung:** Die API Routes sind in `Agents.md` aufgelistet, aber es gibt keine detaillierte API-Dokumentation (Request/Response Schemas, Fehlercodes, Beispiele).
**Priorität:** 🟢 Niedrig
**Aufwand:** 4-6h
**Fix:** OpenAPI/Swagger Spec oder zumindest eine `docs/api.md` mit Beispielen.

### DOC-4: Thoughtprocess Dateien im Root
**Beschreibung:** `thoughtprocess/` enthält Development-Notizen (001/002_thoughtprocess.txt, Code-Snapshots). Das ist nützlicher Kontext, aber gehört eher in `docs/dev-log/` oder ein Wiki.
**Priorität:** 🟢 Niedrig
**Aufwand:** 15min

---

## 🟢 Niedrig – Nice-to-Have

### NICE-1: Docker-Compose nur für SearXNG
**Beschreibung:** `docker-compose.yml` enthält nur den SearXNG Service. LocAI selbst hat keine Docker-Konfiguration.
**Priorität:** 🟢 Niedrig
**Aufwand:** 2-3h
**Fix:** `Dockerfile` für LocAI + Multi-Service docker-compose (LocAI + SearXNG + Ollama).

### NICE-2: Keine Favicon-Varianten
**Beschreibung:** Nur `favicon.ico` vorhanden, keine PWA-Icons (manifest.json, apple-touch-icon, etc.).
**Priorität:** 🟢 Niedrig
**Aufwand:** 1h

### NICE-3: Keine Rate-Limiting auf API
**Beschreibung:** API Routes haben kein Rate-Limiting. Für lokalen Betrieb ok, aber bei `LOCAI_ALLOW_REMOTE=true` problematisch.
**Priorität:** 🟢 Niedrig
**Aufwand:** 2h

### NICE-4: next.config.ts ist leer
**Beschreibung:** Die Next.js Config enthält keine Konfiguration. Empfohlene Optionen:
- `images.domains` für externe Bilder
- `experimental.serverActions` falls nötig
- CSP Headers
- `output: 'standalone'` für Docker
**Priorität:** 🟢 Niedrig
**Aufwand:** 1h

---

## Quick Wins (auf nightly Branch umgesetzt)

Die folgenden Änderungen wurden direkt auf `nightly/04-02-2026` committed:

- [x] `CQ-1`: Lint Warnings behoben (unused imports, let→const, @ts-ignore→@ts-expect-error)
- [x] `CQ-5`: package.json Name von "mc_agent" → "locai"
- [x] `ARCH-3`: `.env.example` erstellt
- [x] `DOC-2`: README Clone-URL korrigiert
- [x] `CQ-3` (partial): Riesigen `console.log` in `ollama.ts` entfernt (loggte Base64-Payloads)
