# LocAI Context Handoff – Sprint 5 File Canvas

**Last updated:** 2026-02-18 23:xx  
**Branch:** `sprint5/feat-file-canvas` (pushed, PR open)  
**Commit:** `93120c7`  
**Build:** ✅ green (lint warnings only – all pre-existing)  
**Tests:** ✅ 100/100  

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
