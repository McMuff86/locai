# CONTEXT-HANDOFF.md

> **Zweck:** Übergabe-Dokument zwischen Agent-Sessions.
> Bevor ein Agent out-of-context geht, beschreibt er hier den aktuellen Stand.
> Der nächste Agent liest dieses File zuerst.

---

## Letzter Agent
- **Rolle:** 🎨 UI Polish Agent Runde 2 (Subagent)
- **Datum:** 18.02.2026
- **Branch:** `sprint5/ui-polish-round2` (von main, gepusht, PR-ready)
- **Commit:** `be575e9 feat(ui): Model descriptions, wider layout, image preview in FileBrowser`

---

## Was wurde gemacht (Sprint 5 – UI Polish Runde 2)

### ✅ 1. Model Card: Modell-Beschreibungen
- **Datei:** `src/components/chat/SetupCard.tsx`
- Neues `MODEL_DESCRIPTIONS`-Array mit Regex-Patterns für bekannte Modelle (deutsch)
- Funktion `getModelDescription(modelName)` mit Fallback basierend auf Parametergrösse
- Beschreibung wird als `<p className="text-sm text-muted-foreground">` unter dem Dropdown angezeigt
- Deckt ab: qwen, llama3.x, deepseek, mistral, codellama, gemma, phi, command-r, hermes u.v.m.

### ✅ 2. Layout breiter gemacht
- **SetupCard:** `max-w-2xl` → `max-w-4xl` (mehr Breite für den Setup-Bereich)
- **Documents Page:** `max-w-4xl mx-auto` entfernt → volle verfügbare Breite für FileBrowser

### ✅ 3. Bild-Preview im FileBrowser
- **Neuer API-Endpoint:** `src/app/api/filebrowser/image/route.ts`
  - Liefert Bilder mit korrektem MIME-Type (image/svg+xml, image/png, image/jpeg, etc.)
  - URL: `/api/filebrowser/image?rootId=<id>&path=<filepath>`
- **`src/lib/filebrowser/types.ts`:** `FilePreviewType` um `'image'` erweitert
- **`src/lib/filebrowser/scanner.ts`:**
  - `IMAGE_EXTENSIONS` Set hinzugefügt (.svg, .png, .jpg, .jpeg, .gif, .webp, .avif, .ico)
  - `getPreviewType()`: Gibt `'image'` für Bilddateien zurück (statt `'binary'`)
  - `readFileContent()`: Für `previewType === 'image'` early return (kein Binärfehler)
- **`src/components/filebrowser/FilePreviewDialog.tsx`:**
  - `PreviewContent` erhält `rootId` und `relativePath` als Props
  - Neuer `case 'image'`: Rendert `<img src="/api/filebrowser/image?...">` zentriert mit `max-h-[70vh] object-contain`

---

## Was als nächstes zu tun ist

- **PR reviewen & mergen:** `sprint5/ui-polish-round2` → main
  - URL: https://github.com/McMuff86/locai/pull/new/sprint5/ui-polish-round2
- Vorherigen PR `sprint5/ui-cleanup-polish` zuerst mergen falls noch offen
- **RAG Upgrade (FEAT-2):** implementieren nach ADR-002
- **Sidebar Collapse:** Component Upgrade Spec in `docs/design/component-upgrades.md` (Abschnitt 6)
- **Toast Redesign:** `.toast-premium` CSS-Klassen sind bereit, Shadcn Toaster muss angepasst werden
- **MarkdownRenderer + CodeBlock:** Upgrade-Spec in component-upgrades.md (Abschnitt 2)

---

## Wichtige Dateien (geändert in dieser Session)

| Datei | Was |
|-------|-----|
| `src/components/chat/SetupCard.tsx` | Model-Beschreibungen + max-w-2xl → max-w-4xl |
| `src/app/(app)/documents/page.tsx` | max-w-4xl Constraint entfernt |
| `src/app/api/filebrowser/image/route.ts` | **NEU** – Image-Serving mit korrektem MIME-Type |
| `src/lib/filebrowser/types.ts` | FilePreviewType += 'image' |
| `src/lib/filebrowser/scanner.ts` | IMAGE_EXTENSIONS, getPreviewType, readFileContent |
| `src/components/filebrowser/FilePreviewDialog.tsx` | Image-Rendering via \<img\> |

## Wichtige Dateien aus Vorrunde (unverändert, für nächste Session relevant)

| Datei | Was |
|-------|-----|
| `src/hooks/useAgentChat.ts` | Default isAgentMode: false → true (Runde 1) |
| `src/app/globals.css` | Design System Tokens (Runde 1) |
| `src/components/chat/ChatMessage.tsx` | Message Bubble Polish (Runde 1) |
| `src/components/chat/ChatContainer.tsx` | Shimmer statt Pulse (Runde 1) |

## Wichtige Dateien (unverändert, für nächste Session relevant)

| Datei | Zweck |
|-------|-------|
| `docs/design/design-system.md` | Design System Spec (Source of Truth) |
| `docs/design/component-upgrades.md` | Component Upgrade Specs (Sidebar, Toast, CodeBlock) |
| `docs/design/tailwind-tokens.ts` | CSS Variables + Framer Motion Tokens |
| `docs/adr/ADR-002-rag-upgrade.md` | RAG Upgrade Architektur |
| `src/lib/agents/workflow.ts` | Workflow Engine |

---

## Preflight Status
```
✅ npm run preflight – Build erfolgreich, keine TypeScript-Fehler
   (sprint5/ui-polish-round2, Commit be575e9)
```

---

### Regeln für die Übergabe

1. **VOR dem Ende jeder Session** dieses File updaten
2. **Konkret sein** – keine vagen Beschreibungen
3. **Branch + letzte Commits** angeben
4. **Offene Fragen** explizit markieren
5. **Dateipfade** angeben die geändert/erstellt wurden
