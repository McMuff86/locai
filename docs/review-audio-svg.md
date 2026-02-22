# Code Review: Audio/SVG Improvements

**Branch:** `nightly/23-02-audio-svg-improvements`  
**Reviewer:** Sentinel (automated)  
**Date:** 2026-02-23  

## Summary

6 commits adding voice clone UI, shared audio hook, SVG viewer/editor, and tests. **Overall quality: Good.** One critical fix applied, rest is clean.

## Checklist Results

### 1. TypeScript Strict ✅
- No `any` types found
- No `@ts-ignore` directives
- **Fixed:** Test mock used `unknown` spread → changed to `Record<string, unknown>` (TS2698)

### 2. Security ✅
- **Upload route:** MIME whitelist (7 audio types), 50MB size limit, filename fully server-generated (no user input in path) → no path traversal possible
- **Transcribe route:** Uses `validatePath()` to confine to `~/.locai/audio/references/` — path traversal blocked
- **SVG preview:** Uses `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}">` — XSS-safe (no `dangerouslySetInnerHTML`, no inline SVG DOM)
- Both routes use `assertLocalRequest()` guard

### 3. Error Handling ✅
- Both API routes wrap in try/catch with `instanceof Error` message extraction
- Frontend: error state displayed, loading states managed
- Transcribe gracefully falls back to default URL if settings fetch fails

### 4. Shared Hook (`useAudioPlayback`) ✅
- Event listeners properly cleaned up in `useEffect` return
- State reset on `src` change (prevents stale state)
- No memory leaks detected — `useCallback` used for stable references
- **Minor note:** `useEffect([], [])` with `audioRef` — ref is stable so empty deps is correct, but if audio element is conditionally rendered, listeners could be missed. Current usage always renders `<audio>`, so this is fine.

### 5. Breaking Changes ✅
- `AudioPlayer` props unchanged: `{ src, title?, downloadable?, compact? }`
- `WaveformPlayer` props unchanged: `{ src, title?, downloadable?, onSendToRemix?, onSendToRepaint? }`
- New features (speed, loop, keyboard) are additive only

### 6. SVG Preview ✅
- Uses `encodeURIComponent` + data URL via `<img>` tag — safe against XSS
- Separate code/preview tabs in FileWindow
- SVG removed from `IMAGE_EXTENSIONS`, gets own `FilePreviewType`
- `FilePreviewDialog` also uses the same safe pattern

### 7. Tests ✅ (24 tests across 3 files)
- `audioUtils.test.ts` (13): formatTime edge cases (NaN, Infinity, negative), extractFilename
- `uploadAndTranscribe.test.ts` (7): Missing file, bad MIME, too large, success; missing path, traversal, success
- `svgPreview.test.ts` (4): Type detection, image exclusion verification
- **All 200 tests pass**, including pre-existing tests

## Critical Fix Applied

| File | Issue | Fix |
|------|-------|-----|
| `uploadAndTranscribe.test.ts:23` | `...data` on `unknown` type (TS2698) | Changed mock param to `Record<string, unknown>` |

## Minor Notes (no fix needed)

1. **SaveMenu silent catch:** `catch { // silently fail }` — consider a toast or console.warn for debugging
2. **WaveformPlayer action bar** now always renders (even without downloadable/remix/repaint) — intentional for speed/loop controls, but adds slight DOM overhead when no actions needed
3. **Pre-existing TS errors** unrelated to this branch: PDFViewer module, workflow route type mismatch

## Verdict

**✅ Approved.** Clean refactoring with good security practices, proper cleanup, no breaking changes, and solid test coverage.
