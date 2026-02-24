# Performance & Lighthouse Audit

**Datum:** 2026-02-24  
**Branch:** `sprint6/perf1-lighthouse-memleaks`

---

## 1. Memory Leak Audit

### Gefixt ✅

| Datei | Problem | Fix |
|-------|---------|-----|
| `gallery/MetadataPanel.tsx` | `setTimeout` in click handler ohne Cleanup | Timer-Ref mit useEffect-Cleanup |
| `chat/MarkdownRenderer.tsx` | CopyButton setTimeout ohne Cleanup | Timer-Ref mit useEffect-Cleanup |
| `flow/RunHistoryPanel.tsx` | setCopiedId setTimeout ohne Cleanup | Timer-Ref mit useEffect-Cleanup |
| `notes/hooks/useGraph.ts` | setEmbeddingsStatus setTimeout ohne Cleanup | Timer-Ref |
| `settings/page.tsx` | showSaved/showStatus setTimeout ohne Cleanup | Timer-Refs mit useEffect-Cleanup |
| `filebrowser/FilePreviewDialog.tsx` | setCopied setTimeout ohne Cleanup | Timer-Ref mit useEffect-Cleanup |
| `filebrowser/FileEntryRow.tsx` | setConfirmDelete setTimeout ohne Cleanup | Timer-Ref mit useEffect-Cleanup |
| `filebrowser/FileWindow.tsx` | setCopied setTimeout ohne Cleanup | Timer-Ref mit useEffect-Cleanup |
| `audio/SaveMenu.tsx` | setSaved setTimeout ohne Cleanup | Timer-Ref mit useEffect-Cleanup |

### Kein Leak (bereits korrekt) ✅

| Datei | Pattern |
|-------|---------|
| `HealthIndicator.tsx` | `setInterval` mit `clearInterval` in Cleanup |
| `GpuFloatWidget.tsx` | `setInterval` + `addEventListener` mit vollem Cleanup |
| `ProviderHealthWidget.tsx` | `setInterval` mit Cleanup |
| `SystemMonitor.tsx` | `setInterval` mit Cleanup |
| `ChatHeader.tsx` | `setInterval` mit Cleanup |
| `ComfyUIWidget.tsx` | `setInterval` mit Cleanup |
| `GpuMonitorDialog.tsx` | `setInterval` mit Cleanup |
| `GpuMonitorWidget.tsx` | `setInterval` mit Cleanup |
| `terminal/TerminalInstance.tsx` | WebSocket + ResizeObserver + reconnect Timer: volles Cleanup |
| `gallery/ImageGallery.tsx` | `addEventListener` mit `removeEventListener` |
| `filebrowser/ImageEditor.tsx` | `addEventListener` mit `removeEventListener` |
| `filebrowser/FileCanvas.tsx` | `addEventListener` mit `removeEventListener` |
| `RightSidebar.tsx` | `addEventListener` mit `removeEventListener` |
| `chat/ChatContainer.tsx` | `addEventListener` + `setTimeout` mit Cleanup |
| `chat/ChatSearch.tsx` | Debounce-Ref mit `clearTimeout` |
| `shared/TagInput.tsx` | `addEventListener` mit Cleanup |
| `chat/SetupCard.tsx` | `addEventListener` mit Cleanup |
| `chat/AgentModeToggle.tsx` | `addEventListener` mit Cleanup |
| `notes/NotesList.tsx` | `addEventListener` mit Cleanup |
| `notes/hooks/useNoteSearch.ts` | Debounce mit Cleanup |
| `notes/hooks/useGraph.ts` (debounce) | `setTimeout` mit Cleanup |
| Zustand Stores | Singleton pattern, auto-unsubscribe via hooks |

### Geringes Risiko (nicht gefixt)

| Datei | Pattern | Grund |
|-------|---------|-------|
| `ComfyUIWidget.tsx:94` | `setTimeout(checkStatus, 3000)` in event handler | Nur bei manuellem Launch, selten |
| `GpuMonitorWidget.tsx:252` | `setTimeout(fetchStats, 500)` nach Kill | Einmalig pro Aktion |
| `documents/DocumentCard.tsx:188` | `setTimeout(setIsEditing, 50)` | 50ms, vernachlässigbar |
| `chat/ChatInput.tsx:198` | `setTimeout` für Focus | Einmalig, kurz |

---

## 2. Lighthouse Optimierungen

### Metadata ✅ (gefixt)

- [x] `lang="de"` auf `<html>` (war `"en"`)
- [x] Viewport-Config mit `width: device-width, initialScale: 1`
- [x] `theme-color` Meta-Tags für Light/Dark Mode
- [x] OpenGraph Meta-Tags
- [x] Favicon-Referenz

### Accessibility (A11y) - Offene Punkte

#### Icon-Only Buttons ohne `aria-label` ⚠️

**39 Buttons** mit `size="icon"` gefunden. Viele haben `title=` (hilft Screenreadern teilweise), aber kein explizites `aria-label`.

**Empfehlung:** `aria-label` zu allen icon-only Buttons hinzufügen. Buttons mit `title=` sind weniger kritisch, da `title` als accessible name fallback dient.

**Betroffene Dateien (ohne title):**
- `gallery/Lightbox.tsx` - Prev/Next Navigation
- `filebrowser/FileBrowser.tsx` - Einige Move-Picker Buttons

#### Bilder ✅

Alle `<img>` Tags haben `alt`-Attribute.

### Performance Empfehlungen

#### Bundle Size (bereits optimiert in sprint6/perf1-bundle-lazy-loading)
- Lazy Loading für schwere Komponenten bereits implementiert
- Dynamic imports für PDF Viewer, Terminal, Audio Studio

#### CLS (Cumulative Layout Shift)
- **Skeleton Loader** für Chat-Nachrichten und Listen vorhanden
- **Fixe Höhen** für Header/Navigation gesetzt
- **Potential:** Gallery-Bilder könnten `aspect-ratio` oder explizite `width/height` nutzen

#### LCP (Largest Contentful Paint)
- **Font Loading:** Google Fonts via `next/font` (optimiert)
- **Potential:** Preload für kritische Above-the-fold Inhalte

#### Weitere Optimierungen
- `next/image` wird nicht genutzt (alle Bilder sind dynamisch/API-generated)
- Service Worker für Offline-Caching wäre möglich
- HTTP/2 Push für kritische Assets

---

## 3. Zusammenfassung

| Bereich | Status | Details |
|---------|--------|---------|
| Memory Leaks | ✅ Gefixt | 9 setTimeout-Leaks behoben |
| Event Listener Cleanup | ✅ OK | Alle korrekt implementiert |
| WebSocket Cleanup | ✅ OK | TerminalInstance vollständig |
| Store Subscriptions | ✅ OK | Zustand auto-cleanup |
| Metadata/SEO | ✅ Gefixt | Viewport, theme-color, OG tags |
| HTML Lang | ✅ Gefixt | `en` → `de` |
| Accessibility | ⚠️ Teilweise | Icon-Buttons brauchen aria-labels |
| Bundle Size | ✅ OK | Lazy loading bereits implementiert |
