# LocAI Context Handoff – Sprint 5 UI Polish Round 3

**Last updated:** 2026-02-18 23:xx  
**Branch:** `sprint5/ui-polish-round3` (pushed, PR open)  
**Commit:** `85ab1fe`  
**Build:** ✅ green (lint warnings only – all pre-existing)  
**Tests:** ✅ 100/100  

---

## Was wurde gemacht (Runde 3)

### 1. Breiteres Chat-Layout ✅
- `ChatContainer.tsx`: Outer-Padding von `p-4` auf `py-3` reduziert (kein seitliches Padding), innerer Wrapper `px-4 lg:px-8` → `px-3 lg:px-5`
- `SetupCard.tsx`: `max-w-4xl` → `max-w-5xl` (1024px statt 896px)
- `chat/page.tsx`: Agent/Workflow/Input-Wrapper auf `px-3 lg:px-5` vereinheitlicht
- **Effekt:** Content nutzt jetzt ~85-90% der verfügbaren Breite

### 2. Code Block Upgrade (MarkdownRenderer) ✅
- Language-Color-Dot: TypeScript=blau, Python=grün, Bash=smaragd, JSON=gelb, usw.
- Copy-Button mit State Machine (idle → copied → idle via Framer Motion)
- Word-Wrap Toggle Button pro Code-Block
- Auto-Zeilennummern wenn >10 Zeilen
- Dunklerer Header vs. Body (Kontrast)

### 3. ToolCall Cards (ToolCallBlock) ✅
- Emoji-Map pro Tool: 🌐 Web, 📖 Read, ✍️ Write, ⚡ Run, 🎨 Image, 🧠 Memory…
- Animierter Status-Dot für "running" (Puls-Glow, kein Layout-Shift)
- Chevron dreht 90° beim Expand (Framer Motion)
- Duration auf abgeschlossenen Calls
- Status-basierte Border + Glow

### 4. Sidebar Collapse (layout.tsx) ✅
- Framer Motion `layout` Animation: 224px ↔ 56px, 0.25s ease
- Labels fade+slide via AnimatePresence
- `layoutId="sidebar-active-indicator"` – aktive Route gleitet zwischen Einträgen
- CSS Hover-Tooltip im Collapsed-State (kein Radix, reines CSS)
- Collapse-State in localStorage persistiert (`locai-sidebar-collapsed`)

### 5. FileBrowser – Open in Agent ✅
- `FileEntryRow.tsx`: Bot-Icon-Button als Quick-Action (ohne Preview zu öffnen)
- `FileBrowser.tsx`: `handleOpenInAgent` – liest Datei via `/api/filebrowser/read`, schreibt sessionStorage, navigiert zu `/chat?openFileInAgent=true`
- (FilePreviewDialog hatte schon "Open in Agent" – jetzt auch direkt in der Liste)

### 6. File-Editing im FilePreviewDialog ✅ (NEUE ANFORDERUNG)
- **Edit-Button** in der Header-Zeile (nur Workspace-Root, nur nicht-gekürzte Dateien)
- Unterstützte Typen: `text`, `code`, `json`, `markdown`
- **Text/Code/JSON:** Textarea-Edit-Mode mit Auto-Focus, Save/Abbrechen
- **Markdown:** Tab-Toggle "Bearbeiten" / "Vorschau" mit Live-MarkdownRenderer
- **Speichern** → `POST /api/filebrowser/write` → Toast + `refresh()` im FileBrowser
- Abbrechen stellt den Zustand wieder her

### 7. NEW API: `/api/filebrowser/write` ✅
- `POST { rootId, path, content }` → überschreibt bestehende Workspace-Datei
- Backed by `scanner.writeFileContent()` – nur Workspace, nur Files (keine Dirs)
- Gibt aktualisiertes `FileEntry` zurück

---

## Noch offen / Für Runde 4

### UI
- Toast Redesign (Glass Morphism, Slide-in von rechts mit Progress Bar) – noch nicht gemacht
- Shimmer vs. animate-pulse – schon in globals.css definiert, aber nicht alle Stellen umgestellt

### Features
- Chat-Messages in Bubbles-Layout: `max-w-[82%]` evtl. auf `max-w-[90%]` erhöhen für breite Screens
- FilePreviewDialog: Edit für Binary/Image ausgeblendet – ggf. Hinweis "nicht editierbar" anzeigen
- Rename in FilePreviewDialog direkt (aktuell nur in FileBrowser-Liste via Dialog)

### Tech
- `@radix-ui/react-tooltip` installieren wenn mehr Tooltips gebraucht werden
- CSS-Tooltip im Sidebar ist funktional aber nicht 100% design-konsistent

---

## Architektur-Notizen

### Layout-Hierarchie
```
AppLayout (layout.tsx)
└── motion.nav (sidebar, 56px↔224px, Framer layout)
└── main (flex-1, min-w-0)
    └── children (chat page, etc.)

Chat Page
└── ConversationSidebar (wenn vorhanden)
└── flex-1 flex flex-col
    ├── ChatHeader
    ├── ChatContainer (flex-1, py-3)
    │   └── div.w-full.px-3.lg:px-5
    │       └── ChatMessage (max-w-[95%] linear / max-w-[82%] bubbles)
    ├── AgentMessage wrapper (px-3 lg:px-5)
    └── ChatInput wrapper (px-3 lg:px-5 pb-6)
```

### FileBrowser Write Flow
```
User klickt "Bearbeiten" in FilePreviewDialog
→ isEditMode = true, editedContent = preview.content
→ Textarea erscheint
→ User bearbeitet → klickt "Speichern"
→ POST /api/filebrowser/write { rootId, path, content }
→ scanner.writeFileContent() → fs.writeFile(path, content, 'utf-8')
→ toast("Gespeichert") + onSaved() → FileBrowser.refresh()
```

### Sidebar Collapse
```
Collapsed = 56px (Icons only)
Expanded  = 224px (Icons + Labels)
Transition: Framer Motion layout, 0.25s [0.4,0,0.2,1] ease
Tooltip: CSS group-hover/tip, absolute left-full, z-50
Active indicator: motion.span layoutId="sidebar-active-indicator"
Persist: localStorage['locai-sidebar-collapsed']
```
