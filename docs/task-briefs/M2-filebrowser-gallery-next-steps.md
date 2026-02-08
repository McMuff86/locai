# M2 – File Browser & Gallery Next Steps

> Date: 2026-02-08
> Scope: Follow-up plan after File Browser UX/Actions + Gallery Drag&Drop upload

## Implemented in this PR

### File Browser
- Added search, sort, type filter, extension filter.
- Added workspace actions: create file, create folder, rename, move, upload.
- Added drag & drop:
  - External files -> current directory.
  - External files -> specific subdirectory.
  - Internal workspace entries -> move by dropping on directory/current path.
- Improved preview:
  - Truncation awareness (100KB preview cap shown in UI).
  - Copy-to-clipboard action.
  - Stable preview mapping using `rootId + relativePath`.
- Backend improvements:
  - Download endpoint switched to stream response.
  - New mutation routes: create / rename / move / upload.
  - Optional `includeChildCount` listing parameter (performance control).

### Gallery
- Added drag & drop upload support in gallery UI.
- Added `/api/comfyui/gallery/upload` endpoint with:
  - Local-request guard.
  - Filename sanitization.
  - File type allowlist.
  - Size limit (50MB/file).
  - Automatic collision-safe filenames.
  - Cache invalidation after upload.

## Open Items (Next Priority)

1. Replace `window.prompt` based actions with proper dialogs
- Create file/folder dialog (validation + inline errors).
- Rename dialog.
- Move dialog with target folder picker.

2. Add quick actions in preview
- `Open in Agent` (pre-fill chat input / tool context).
- `Add to RAG` (upload selected file to document pipeline).

3. Improve drag & drop UX
- Better directory-level drop indicators for nested moves.
- Explicit toast feedback per operation (move/rename/create/upload).
- Keyboard-accessible alternatives for all DnD actions.

4. Hardening / API consistency
- Unify error response format across filebrowser endpoints.
- Add input schemas and stricter validation for mutation routes.
- Add optional max upload count per request.

5. Tests
- Add scanner unit tests for:
  - create/rename/move/upload path validation.
  - workspace-only mutation guard.
- Add API tests for filebrowser mutation endpoints.
- Add gallery upload endpoint tests.

## Manual QA Checklist

1. File Browser
- Browse all roots and navigate breadcrumbs.
- Search/filter/sort combinations.
- Create file/folder in workspace.
- Rename + move file/folder in workspace.
- Drag file from list into another folder.
- Drag external file into current folder and specific subfolder.
- Preview large text file: truncation notice appears.
- Download still works for previewed and listed files.

2. Gallery
- Drag image/video files into gallery area.
- Verify upload success + list refresh.
- Verify unsupported extensions are rejected.
- Verify duplicate filename handling appends suffix.

## Known Environment Notes

- `npm run typecheck` currently fails due to existing project issue:
  - Missing `chokidar` type/module resolution in `src/lib/galleryCache.ts`.
- `npm run test` currently has pre-existing unrelated failures in:
  - `src/lib/agents/tools/tools.test.ts`
  - `src/lib/galleryCache.test.ts`

These are not introduced by this PR.
