# ADR-007: Local-First AI Workspace Platform Direction

**Status:** Proposed  
**Date:** 2026-06-17  
**Context:** LocAI should move closer to a Genspark-class AI workspace while preserving local ownership and multi-model flexibility.

---

## Context

LocAI already has a strong foundation:

- Chat and agent workflows.
- Visual Flow Builder.
- Local-first storage patterns.
- Documents/RAG, notes, memory, file browser, terminal, gallery, image/audio tools.
- Provider abstraction for Ollama, Anthropic, OpenAI, and OpenRouter.
- Per-node provider/model/settings in workflows.

Genspark's current product pattern is broader than chat: it packages autonomous work into artifacts such as docs, slides, sheets, podcasts, websites, and scheduled workflows. It also adds desktop/browser/Office/meeting integrations and custom agents.

The strategic question is whether LocAI should clone Genspark features one by one or define a local-first architecture that can grow into similar outcomes.

---

## Decision

LocAI will evolve into a **local-first AI workspace platform** with four primary layers:

1. **Workspace Core**
   - Projects, artifacts, savepoints, provenance, source references, exports, run ledgers.

2. **Agent Runtime**
   - Existing chat/workflow engine plus supervisor planning, skill invocation, model routing, memory, and human checkpoints.

3. **Artifact Modules**
   - Research briefs, docs, sheets, decks, reports, code outputs, images, audio, and workflow outputs as first-class editable objects.

4. **Connector Gateway**
   - Permissioned access to built-in tools, MCP servers, OpenAPI tools, local files, browser automation, shell/code execution, and optional external services.

LocAI will remain local-first:

- Ollama/local models stay the default path.
- Cloud providers are optional and explicit.
- Local project data is stored under `~/.locai/` by default.
- Any external mutation or account action needs approval policy.

---

## Consequences

### Positive

- The product direction becomes coherent: chat, flow, files, memory, and tools all organize around projects/artifacts.
- Existing LocAI architecture remains useful instead of being replaced.
- New feature work can be scoped against reusable platform primitives.
- Local-first positioning stays distinct from Genspark.

### Negative

- More upfront product architecture before visible "wow" features.
- Requires migration thinking for existing conversations, workflows, and memory.
- Permissions and provenance add implementation overhead.

### Neutral / Follow-Up

- A dedicated `/workspace` route should become the primary artifact/project surface.
- Flow Builder should remain inspectable automation, not disappear behind a black-box Super Agent.
- "Super Agent" should be implemented as supervisor + skills + workflow templates, not as one giant prompt.

---

## Implementation Notes

Recommended first implementation slice:

1. Define workspace/project/artifact domain types.
2. Add filesystem store under `~/.locai/projects/`.
3. Add API routes for projects/artifacts/savepoints.
4. Add minimal workspace UI.
5. Make one workflow produce a research artifact.

This creates a reusable spine for Docs, Sheets, Slides, Deep Research, and future automation.

---

## Related

- `docs/goals/2026-06-genspark-class-local-ai-workspace-roadmap.md`
- `docs/adr/ADR-008-permissioned-tool-connector-gateway.md`
- `docs/adr/ADR-009-artifact-project-model.md`
