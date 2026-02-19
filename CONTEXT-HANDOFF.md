# LocAI Context Handoff - Flow MVP (Execution Pack Complete)

**Last updated:** 2026-02-19 16:48  
**Branch:** `main`  
**Build:** OK (`typecheck`, `lint`, `build` pass; lint warnings are pre-existing)  
**Tests:** Partial OK (`npm run test` still has 4 known Windows-incompatible `run_command` failures in `src/lib/agents/tools/tools.test.ts`; flow compiler tests pass)

## Flow MVP Status

### Scope and decision
- Source docs:
  - `docs/adr/ADR-003-locai-flow-mvp.md`
  - `docs/task-briefs/M3-flow-mvp.md`
  - `docs/task-briefs/M3-T1-flow-next-execution-pack.md`
- `/flow` stays a visual front-end that compiles into existing workflow engine plans.
- MVP keeps linear execution semantics.

### Completed in this round (M3-T1.1 to M3-T1.5)
- **T1.1 Palette Drag and Drop**
  - Drag payload from palette via `application/locai-flow-node`.
  - Canvas drop with `screenToFlowPosition` mapping.
  - Click-to-add preserved.
- **T1.2 Wire Typing + Validation**
  - Port schema and wire types added (`string`, `json`, `any`, `stream`).
  - Connection validation (`isValidConnection`) blocks incompatible links.
  - Invalid connection shows toast.
  - Edge style is typed/colorized by wire type.
- **T1.3 Cmd/Ctrl+K Node Command Palette**
  - Global shortcut in `/flow` opens palette.
  - Live search/filter over node types.
  - Enter inserts selected node into viewport center.
  - Escape closes cleanly.
- **T1.4 Run History Panel**
  - New bottom panel lists latest runs with status, duration, start time, and error.
  - Clicking a run reapplies stored node runtime status snapshot (read-only replay light).
  - Latest 30 runs limit is still enforced.
- **T1.5 Compiler Tests**
  - Added `src/lib/flow/__tests__/engine.test.ts` with coverage for:
    - linear graph compile
    - cycle detection
    - missing agent error
    - dependsOn mapping

### Key files touched
- `src/app/(app)/flow/page.tsx`
- `src/components/flow/FlowCanvas.tsx`
- `src/components/flow/NodeCommandPalette.tsx`
- `src/components/flow/RunHistoryPanel.tsx`
- `src/lib/flow/types.ts`
- `src/lib/flow/registry.ts`
- `src/lib/flow/__tests__/engine.test.ts`
- `src/stores/flowStore.ts`

### Validation in this round
- `npm run typecheck` PASS
- `npm run lint` PASS (warnings only, pre-existing)
- `npm run build` PASS
- `npm run test` WARN (fails on known Windows-specific `run_command` tests)
- `npx vitest run src/lib/flow/__tests__/engine.test.ts` PASS

### Next recommended work
1. Start Phase 2 control-flow nodes (`if/else`, `loop`, `merge`, `parallel`) with explicit compile/runtime rules.
2. Add runtime timeline/event panel wired to workflow stream events.
3. Address cross-platform `run_command` tests to make full `npm run test` green on Windows.

---

# LocAI Context Handoff – Sprint 5 Image Editor

**Last updated:** 2026-02-19 00:52  
**Branch:** `sprint5/feat-image-editor` (pushed)  
**Commit:** `81cc612`  
**Build:** ✅ green (lint warnings only – all pre-existing)  

## 🖼️ Image Editor Feature (NEW)

### What was built
Full image editor integrated into the FileWindow canvas system. When an image is opened,
a "Bearbeiten" toggle switches between view mode and full editor mode.

### New Files
- `src/components/filebrowser/ImageEditor.tsx` – Main editor (HTML Canvas API, ~900 lines)
- `src/components/filebrowser/ImageToolbar.tsx` – Grouped toolbar with icons + tooltips
- `src/hooks/useImageEditor.ts` – State management (undo/redo, tools, settings)
- `src/app/api/image-editor/ai-describe/route.ts` – Ollama vision description
- `src/app/api/image-editor/ai-edit/route.ts` – ComfyUI img2img editing
- `src/components/ui/{slider,tooltip,popover,select}.tsx` – Shadcn components

### Modified Files
- `FileWindow.tsx` – Added ImageEditor integration, edit toggle button
- `useFileCanvas.ts` – Larger default size for image windows (700×500)
- `scanner.ts` – Added `writeFileBinary()` for base64 image saving
- `write/route.ts` – Added `encoding: 'base64'` support

### Features
- **Transform:** Crop, Resize (aspect lock), Rotate 90°CW/CCW, Flip H/V
- **Adjust:** Brightness, Contrast, Saturation, Blur, Sharpen, Grayscale, Sepia, Invert (live preview + apply)
- **Draw:** Freehand brush, Eraser, Text overlay, Shapes (rect/circle/line/arrow), Color picker (eyedropper), Blur region
- **AI:** Describe (Ollama vision), Edit (ComfyUI img2img with denoise slider), Before/After compare slider
- **Utility:** Undo/Redo (max 20 steps), Reset, Save, Save As, Export (PNG/JPG with quality)
- **Keyboard:** Ctrl+Z undo, Ctrl+Y redo
- **Status bar:** Dimensions, zoom slider, unsaved indicator

### Architecture
- Pure HTML Canvas API (no Fabric.js/Konva)
- CSS filters for live preview, canvas operations for permanent apply
- Undo stack stores data URLs (max 20)
- Compare mode uses CSS clip-path overlay

---

## Previous context  


---

## Sprint 5 – Fix Canvas + Editor Upgrade (2026-02-19)

### Bug Fix: Doppeltes Öffnen von Dateien im Canvas

**Root Cause:** In `useFileCanvas.ts` war `windows` in der `openFile` Closure captured (stale closure). Bei schnellen Doppelklicks sahen beide Aufrufe `windows = []` und erstellten zwei Fenster.

**Fix:** Deduplizierung jetzt INNERHALB des `setWindows` functional updater – dieser sieht immer den aktuellen State:
```typescript
setWindows((currentWindows) => {
  const existing = currentWindows.find(/* ... */);
  if (existing) return currentWindows.map(/* bring-to-front */);
  return [...currentWindows, newWindow];
});
```
Zusätzlich: `maxZIndex` State durch `useRef` ersetzt (kein Extra-Re-render, kein stale Closure).

### Feature: Editor Upgrade in FileWindow

**Line Numbers (Zeilennummern)**
- Linke Spalte mit Zeilennummern (1, 2, 3, ...)
- Synchronisiertes Scroll über `onScroll` → `lineNumbersRef.scrollTop = textareaRef.scrollTop`
- Gleiche Monospace-Font und Font-Size wie Textarea → perfektes Alignment
- Dynamische Breite: 2.25rem / 2.75rem / 3.25rem / 4rem (für 2/3/4-stellige Zahlen)
- `aria-hidden` (rein dekorativ)

**Status Bar**
- Am unteren Rand des Edit-Fensters
- Format: `Zeichen: X | Wörter: Y | Zeilen: Z | Whitespace: W`
- Live-Update bei jedem Keystroke
- Zeigt "Kein Umbruch" wenn Word Wrap OFF

**Tab Support**
- Tab → 2 Leerzeichen einfügen (kein Focus-Wechsel)
- Shift+Tab → bis zu 2 Leerzeichen am Zeilenanfang entfernen
- Cursor-Position nach State-Update via `requestAnimationFrame`

**Word Wrap Toggle**
- WrapText-Icon in der Toolbar (Shadcn Button variant=secondary wenn AN)
- Default: AN (pre-wrap, overflow-x: hidden)
- AUS: pre, overflow-x: auto (horizontales Scrollen)

**Font Size Zoom**
- ZoomIn / ZoomOut Buttons in Toolbar
- Ctrl+Plus / Ctrl+Minus im Textarea onKeyDown
- Range: 8–24px, Default: 13px
- Aktuelle Größe als 10px Text zwischen den Buttons angezeigt

**Auto-Save Indicator**
- Kleiner Amber-Dot (●) in der Titelleiste
- Erscheint wenn `editedContent !== fileContent.content`
- Verschwindet automatisch nach Speichern oder Abbrechen

---

## Frühere Handoff-Notes (Sprint 5 File Canvas)

---

## Was wurde gemacht (File Canvas)

### 1. `src/hooks/useFileCanvas.ts` – Canvas State Management ✅
- Verwaltet: `windows[]`, `transform: { x, y, zoom }`
- `openFile(file, rootId)`: öffnet Datei; bereits offen → bring-to-front + un-minimize
- Cascade-Positionierung: neue Fenster erscheinen 30px versetzt (max 10 Positionen)
- `closeWindow`, `bringToFront`, `updatePosition`, `updateSize`, `toggleMinimize`, `updateTransform`
- zIndex-Counter via `useRef` (kein unnötiger Re-render)

### 2. `src/components/filebrowser/FileCanvas.tsx` – Canvas Viewport ✅
- Dot-Grid-Hintergrund: skaliert und verschiebt sich mit Zoom/Pan
- Non-passive wheel event listener für Zoom (Browser blockiert sonst `preventDefault`)
- Zoom-to-Cursor: Formel `newX = mouseX - (mouseX - panX) * (newZoom / zoom)`
- Zoom: 15% – 400%, Pinch (ctrlKey) und Mausrad
- Pan: Drag auf leerem Canvas (document-level listener → pan funktioniert auch wenn Maus den Canvas verlässt)
- Reset-Button (bottom-left), Zoom-Indicator (bottom-right)
- Leerer-Zustand-Overlay wenn keine Fenster offen
- Fenster (FileWindow) stoppen Event-Propagation → Canvas-Pan nur auf freier Fläche

### 3. `src/components/filebrowser/FileWindow.tsx` – Datei-Fenster ✅
- Absolut positioniert im World-Koordinatensystem des Canvas
- **Title Bar**: Datei-Icon, Filename, macOS-Stil Buttons (gelb=minimize, rot=close)
- **Drag**: MouseDown auf Title Bar → document-level mousemove dividiert durch Zoom
- **Resize**: Bottom-right Ecken-Handle → document-level mousemove dividiert durch Zoom
- **Min-Size**: 300×200px, **Default**: 500×400px
- **Content Loading**: fetch `/api/filebrowser/read` on mount, lazy per Fenster
- **File Types**: Markdown (MarkdownRenderer), Code (SyntaxHighlighter), JSON (formatted SyntaxHighlighter), Text (pre), Image (img-Tag via `/api/filebrowser/image`), Binary (Fallback-Text)
- **Edit Mode**: Nur Workspace + nicht-gekürzte Dateien + EDITABLE_TYPES
  - Text/Code/JSON: Textarea
  - Markdown: Tab "Bearbeiten" / "Vorschau" (Live-Preview)
  - Save → POST `/api/filebrowser/write` → toast
- **Copy Button**: Clipboard-Copy des aktuellen Inhalts
- Text-Selektion im Content-Bereich aktiviert (userSelect: text)

### 4. Documents Page – Neues Layout ✅
- `src/app/(app)/documents/page.tsx` neu strukturiert:
  - **Links (320px)**: `FileBrowser` mit `onOpenFile` Callback
  - **Rechts (flex-1)**: `FileCanvas` (Haupt-Bereich)
  - RAG Tab bleibt unverändert
- Datei-Klick → `canvas.openFile(entry, entry.rootId)` → Fenster auf Canvas

### 5. FileBrowser – onOpenFile Prop ✅
- Neues optionales Prop: `onOpenFile?: (entry: FileEntry) => void`
- Wenn vorhanden: Datei-Klick ruft `onOpenFile` statt `previewFile` auf
- `FilePreviewDialog` bleibt erhalten (Fallback wenn kein Prop übergeben)
- Komplett rückwärtskompatibel

---

## Architektur

### Koordinatensystem
```
Viewport (CSS overflow:hidden)
└── World div (position:absolute, width:0, height:0)
    transform: translate(panX, panY) scale(zoom)
    transformOrigin: 0 0
    └── FileWindow (position:absolute, left:winX, top:winY)
        → winX/Y in World-Koordinaten
        → screen pos = (panX + winX*zoom, panY + winY*zoom)
```

### Zoom-to-Cursor (Invariante)
```
// Punkt unter dem Cursor soll nach dem Zoom an gleicher Stelle bleiben
// cursor_world = (cursor_screen - panX) / zoom = const
// → newPanX = cursorScreen - (cursorScreen - panX) * (newZoom / zoom)
```

### Event-Fluss
```
Wheel → non-passive DOM listener → zoom + pan adjust
Canvas MouseDown (empty) → isPanningRef = true
Document MouseMove → if isPanning: update panX/panY
Document MouseUp → isPanning = false

Window Title MouseDown → isDraggingRef = true (per FileWindow)
Document MouseMove → if isDragging: pos += delta / zoom
Window Resize Handle MouseDown → isResizingRef = true
Document MouseMove → if isResizing: size += delta / zoom
```

### Datei öffnen – Flow
```
FileBrowser: User klickt Datei
→ handlePreviewOrOpen(entry)
  → onOpenFile prop vorhanden? → canvas.openFile(entry, entry.rootId)
    → useFileCanvas: neues CanvasWindow erstellt
    → FileCanvas rendert FileWindow
    → FileWindow: fetch /api/filebrowser/read on mount
    → Content wird angezeigt
  → kein onOpenFile? → previewFile(entry) → FilePreviewDialog (wie bisher)
```

---

## Noch offen / Für nächste Runde

### Nice-to-have (nicht blockierend)
- Snap-to-Grid beim Window-Release (optisch sauber)
- Drag-Datei aus FileBrowser-Liste direkt auf Canvas droppen (DragEvent → Canvas-Position berechnen)
- Keyboard Shortcut: Escape = aktives Fenster schließen, Ctrl+Z = letzte Position zurück
- Window "Shake" um alle anderen zu minimieren (macOS-Feature)
- Zoom Controls als Buttons (+/-) zusätzlich zum Mausrad

### Potenzielle Verbesserungen
- Canvas-Zustand in sessionStorage speichern (Tab-Reload → Fenster bleiben)
- Fenster-Tab-Bar unten (minimierte Fenster als Tabs)
- Rechtsklick-Kontext-Menü auf Window (Close, Minimize, Duplicate)
- Grid-Toggle (Dots an/aus)

---

## Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Zoom/Pan Library | Keine (pure CSS) | Framer Motion ist bereits da; volle Kontrolle; keine extra Deps |
| zIndex-Counter | useRef | Kein Re-render nötig; nur Inkrementieren |
| Wheel Events | non-passive DOM listener | React's onWheel ist passive by default → kann preventDefault nicht aufrufen |
| Drag (Window) | Document-level listeners | Mouse verlässt sonst das Element und drag stoppt |
| Canvas Background | CSS radial-gradient | Kein SVG overhead, skaliert mit zoom via backgroundSize/Position |
| Edit-Backend | Bestehend (`/api/filebrowser/write`) | Nicht neu bauen; funktioniert bereits |

---

## Frühere Handoff-Notes (Sprint 5 UI Polish Round 3)

### Breiteres Chat-Layout ✅
- `ChatContainer.tsx`: Outer-Padding reduziert, innerer Wrapper `px-3 lg:px-5`

### Code Block Upgrade ✅
- Language-Color-Dot, Copy-Button (Framer Motion), Word-Wrap Toggle, Auto-Zeilennummern

### ToolCall Cards ✅
- Emoji-Map, animierter Status-Dot, Chevron-Animation, Duration

### Sidebar Collapse ✅
- Framer Motion layout, 224px ↔ 56px, CSS Tooltip, localStorage persist

### FileBrowser – Open in Agent ✅
- Bot-Icon als Quick-Action in FileEntryRow

### File-Editing im FilePreviewDialog ✅
- Edit-Button, Textarea, Markdown-Tabs, Save → POST /api/filebrowser/write

### NEW API: `/api/filebrowser/write` ✅
- POST `{ rootId, path, content }` → überschreibt Workspace-Datei

