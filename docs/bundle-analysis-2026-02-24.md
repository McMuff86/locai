# Bundle Size Analysis — 2026-02-24

## Setup

- Added `@next/bundle-analyzer` to `next.config.ts` (run with `ANALYZE=true npm run build`)
- Node_modules disk usage analyzed for largest dependencies

## Largest Dependencies (node_modules size)

| Package | Size | Notes |
|---------|------|-------|
| `@syncfusion/ej2-*` | **571 MB** | PDF viewer — massive, dominates everything |
| `three` | 24 MB | 3D rendering (used by react-force-graph-3d) |
| `openai` | 14 MB | OpenAI SDK |
| `xlsx` | 7.3 MB | Spreadsheet parsing (server-only, already in serverExternalPackages) |
| `tone` | 7.2 MB | Audio synthesis library |
| `@react-three/*` | 5.2 MB | React Three.js bindings |
| `@xyflow/react` | 5.1 MB | Flow editor |
| `@anthropic-ai/sdk` | 5.1 MB | Anthropic SDK |
| `framer-motion` | 3.3 MB | Animation library |

## Key Findings

### 1. Syncfusion PDF Viewer (571 MB!)
The `@syncfusion/ej2-*` packages are by far the largest dependency. This is a known issue with Syncfusion — they bundle everything. Already using `@mcmuff86/pdf-core` in `transpilePackages` which suggests some optimization is in place. Consider:
- Lazy loading the PDF viewer (may already be done via PERF-1 lazy loading PR)
- Evaluating lighter PDF alternatives (react-pdf, pdfjs-dist) if full Syncfusion features aren't needed

### 2. Three.js / 3D Graph (29 MB combined)
`three` + `@react-three/*` are used for 3D force graph visualization. These should be:
- ✅ Lazy loaded (likely already done in PERF-1 lazy loading PR)
- Consider if 2D-only graph (`react-force-graph-2d`) would suffice as default

### 3. Tone.js (7.2 MB)
Audio synthesis library — should be lazy loaded if not already.

### 4. Server-only packages
`xlsx` and `pdf-parse` are correctly listed in `serverExternalPackages` — they won't be in client bundles.

## Already Optimized
- Heavy components lazy loading (merged in prior PERF-1 work)
- API response caching (merged in prior PERF-1 work)
- `xlsx`/`pdf-parse` in `serverExternalPackages`

## Recommendations (future work)
1. **Dynamic import Tone.js** if not already lazy loaded
2. **Evaluate Syncfusion alternatives** for PDF viewing (biggest win potential)
3. **Tree-shake Three.js** — ensure only needed modules are imported
4. Run `ANALYZE=true npm run build` once the pre-existing build error is fixed to get detailed chunk-level analysis
