# Goals: LocAI Repo Improvement Audit

**Date:** 2026-06-18  
**Baseline commit:** `79d2f3c feat: add local AI workspace foundation`  
**Purpose:** Turn the repo audit into concrete improvement goals that support the Genspark-class local workspace roadmap.

---

## Executive Summary

LocAI is already a broad local-first AI workspace, not a simple chat app. The strongest parts are the amount of product surface already present, the provider/tool/workflow foundations, and a real test suite around the agent and workflow core.

The main repo risk is not missing ambition. It is consolidation: storage, API contracts, quality gates, documentation, and permission UX need to become boringly reliable before adding more high-level agent features.

---

## What Is Good

- Strong product surface: chat, flow builder, documents/RAG, notes/graph, gallery, audio, terminal, search, settings, and now workspace artifacts.
- Clear local-first direction: Ollama-first, filesystem-backed `~/.locai` storage, optional cloud providers.
- Useful architectural primitives already exist: provider abstraction, tool registry, workflow engine, Flow Builder, file browser, notes/documents stores.
- Test base is meaningful: 24 Vitest files, 336 tests, including workflow edge cases and security utility tests.
- Security foundation exists: global API middleware, token support, localhost guard, path validation helpers, SSRF validation helpers.
- Workspace direction is now explicit through ADRs and `docs/goals/2026-06-genspark-class-local-ai-workspace-roadmap.md`.
- The first workspace slice is implemented: projects, artifacts, savepoints, run ledger, tool gateway metadata, `/workspace` UI, API routes.

---

## What Is Weak

- Quality gates were inconsistent: tests passed, but typecheck failed after Next generated route types from an invalid layout export.
- Lint is noisy and therefore low-signal. Warnings are numerous enough that new warnings are easy to miss.
- `next lint` is deprecated and should be migrated to the ESLint CLI before Next 16.
- Documentation is stale in places: route counts and some "current test count" statements no longer match the repo.
- API surface is large: production build shows about 90+ API routes. Without generated route inventory and ownership grouping, this will become hard to reason about.
- Storage is fragmented across conversations, documents, notes, memory, settings, workflows, gallery/audio, and now projects/artifacts.
- The new workspace store is filesystem-based and simple, but it does not yet handle concurrent writes, migrations, corruption recovery, or schema validation.
- Tool approval policy is mostly metadata and audit/enforce logic. The user-facing approval UX is not there yet.
- Remote access is all-or-nothing via `LOCAI_ALLOW_REMOTE`; for Tailscale use this is practical, but token guidance and settings UI should become explicit.
- Dev server and production build can corrupt each other if both write `.next` concurrently.

---

## What Is Missing

- First-class artifact creation from chat/workflows. The data layer exists, but normal agent flows still mostly return messages.
- Workspace source manager and citation UI.
- Export adapters for artifacts: PDF, HTML, DOCX, PPTX, XLSX where relevant.
- Model router with health, latency, privacy/cost policy, and fallback logging.
- Skills/custom agents layer that maps user intent to workflow templates and output artifact types.
- Unified search across artifacts, docs, notes, memory, conversations, and workflow history.
- Backup/restore coverage for workspace projects/artifacts/connectors.
- MCP client support behind the tool gateway.
- Human approval checkpoint UI for chat and Flow Builder.
- Generated OpenAPI/route inventory that stays current.
- A visible provider/tool/permission health dashboard.

---

## Completed During This Audit

- Committed the workspace foundation as `79d2f3c`.
- Moved `useNotesContext` out of `src/app/(app)/notes/layout.tsx` into a normal component module so Next route type validation passes.
- Set CI Node version to 22 to match README/setup requirements.
- Set `outputFileTracingRoot` in `next.config.ts` to stop Next from inferring `/home/mcmuff` as the workspace root.

Validation after these changes:

- `npm run lint`: passes with existing warnings.
- `npm run typecheck`: passes.
- `npm test`: passes, 336 tests.
- `npm run build`: passes, `/workspace` builds.

### Second /goals Pass: Chat Workspace Bridge

Implemented after the initial audit:

- Chat now has a compact Workspace bridge for selecting/creating a project, selecting an artifact, toggling capture, saving the last assistant answer, and opening `/workspace`.
- Classic agent runs can pass `workspaceProjectId` and `workspaceArtifactId` into the existing tool gateway context, so real tool calls create run-ledger entries.
- Capture mode creates a workspace artifact before an agent run and updates it with the final answer afterwards, tying tool ledger entries to the artifact.
- Chat exposes a first approval UX: audit/enforce mode plus capability-scope toggles for read, write, network, shell, and code execution.
- Workspace JSON reads now quarantine corrupt files instead of failing the whole store load.

Validation after these changes:

- `npm run typecheck`: passes.
- `npm run lint`: passes with existing repo warnings; the previous `src/app/(app)/chat/page.tsx` hook dependency warning is fixed.
- `npm test`: passes, 337 tests.
- Local dev routes checked: `/chat` and `/workspace` return HTTP 200.

---

## Improvement Goals

### GATE-001: Make Quality Gates Trustworthy

**Status:** in progress
**Why:** Preflight must be reliable before adding broader agent automation.

Done when:

- `npm run preflight` passes from a clean checkout.
- CI uses Node 22.
- Typecheck catches route-module issues without local `.next` surprises.
- Lint warning count is reduced or made enforceable per category.
- Build and dev server workflows are documented so `.next` is not written by two processes at once.

### GATE-002: Reduce Lint Noise

**Status:** in progress
**Why:** A noisy linter is almost the same as no linter.

Done when:

- Unused imports/vars are cleaned in high-touch files.
- React hook dependency warnings are audited and either fixed or documented.
- Image alt warnings are fixed where user-visible.
- `next lint` is migrated to ESLint CLI.

### WORKSPACE-001: Finish Workspace Core Integration

**Status:** in progress
**Why:** The workspace layer exists, but it is not yet the default output surface.

Done when:

- [x] Chat can create a project/artifact from a prompt.
- [ ] Agent workflows can append/update an artifact.
- [x] Run ledger entries appear in `/workspace` after actual tool use when a workspace project/artifact is selected.
- [x] Artifact content supports conversation source links and model provenance for captured chat answers.
- Workspace UI has empty-state onboarding and clear export/savepoint actions.

### SAFETY-001: Turn Tool Gateway Metadata Into UX

**Status:** in progress
**Why:** Approval policy without a user approval flow is only half a safety model.

Done when:

- [x] Chat exposes audit/enforce mode and capability-scope approvals for agent runs.
- [ ] Flow shows required tool scopes before execution.
- [ ] Session/per-call approvals can be granted with a dedicated confirmation UI.
- [x] Denied tool calls return understandable errors through the existing tool-result stream.
- Settings exposes tool registry and approval defaults.

### DATA-001: Consolidate Local Storage Strategy

**Status:** in progress
**Why:** Local-first is only useful if storage is understandable, recoverable, and portable.

Done when:

- `~/.locai` storage areas are documented in one place.
- JSON stores have schema/version validation.
- [x] Corrupted workspace JSON files recover by quarantine.
- Backup/restore includes projects, artifacts, memory, conversations, workflows, settings, audio/image indexes.

### DOCS-001: Make Docs Match Reality

**Status:** proposed  
**Why:** The repo is moving faster than the docs.

Done when:

- API route inventory is generated from `src/app/api`.
- README/AGENTS route and test counts are updated.
- The workspace roadmap reflects Phase 1 progress after `79d2f3c`.
- Setup docs explain Tailscale/remote access with token guidance.

### PRODUCT-001: First Real Deep Research Artifact Flow

**Status:** proposed  
**Why:** This is the first visible Genspark-class outcome that uses the new platform pieces.

Done when:

- A user prompt creates a `research_brief` artifact.
- Sources come from web search, local docs/RAG, notes, and memory.
- The artifact includes plan, findings, analysis, risks, open questions, and next actions.
- The user can edit, savepoint, and export the result.

---

## Recommended Next Slice

1. Commit the gate fixes from this audit.
2. Run full validation (`npm run lint`, `npm test`, optional build when the dev server is not writing `.next`).
3. Add the same workspace artifact context to Workflow Engine mode.
4. Replace scope toggles with a proper per-call approval dialog.
5. Reduce the highest-signal lint warnings in `notes`, `chat`, and workspace files.
6. Generate/update API route docs automatically.
