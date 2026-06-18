# Goals: Genspark-Class Local AI Workspace Roadmap

**Date:** 2026-06-17  
**Status:** Proposed roadmap  
**Repo baseline:** `main` after pull from `https://github.com/McMuff86/locai.git`  
**North Star:** LocAI becomes a local-first AI workspace that can turn one prompt into useful artifacts and actions using local models, LocAI modules, and optional external providers.

---

## Product Thesis

LocAI should not become a generic "chat with tools" app. It should become a **local AI workspace**:

- Chat is the command surface.
- Projects/artifacts are the output surface.
- Flow Builder is the inspectable automation surface.
- Tools/connectors are permissioned capabilities.
- Local models are the default; cloud models are optional accelerators.

Genspark is the benchmark for breadth and outcome packaging. LocAI's differentiator is local ownership, inspectability, CAD/CAM/manufacturing extensibility, and low vendor dependency.

---

## Baseline: What LocAI Already Has

- Next.js 15 app with chat, flow, documents, notes, graph, gallery, audio, terminal, settings.
- Provider abstraction for Ollama, Anthropic, OpenAI, OpenRouter.
- Per-node provider/model/temperature/max-iteration settings in workflows.
- Agent tools for RAG, web search, files, notes, memory, command/code, images, PDFs, Excel, music, TTS.
- Markdown-first memory and local filesystem persistence patterns.
- Flow history, workflow templates, conditions, loops, run output, import/export.

This means the next roadmap should be a product/architecture consolidation, not a ground-up rebuild.

---

## Non-Goals

- Do not clone every Genspark feature by name.
- Do not make cloud accounts mandatory.
- Do not give unrestricted shell/browser/OS access to agents.
- Do not bury everything inside chat transcripts.
- Do not replace Flow Builder with a black-box agent.

---

## Strategic Goals

### GOAL-001: Workspace Core

Introduce first-class projects and artifacts.

Artifacts should include research briefs, docs, sheets, decks, code outputs, images, audio, workflow results, and file-operation reports. Every artifact needs metadata, provenance, savepoints, source links, and export paths.

**Done when:**

- A chat/workflow can create an artifact instead of only a message.
- Artifacts can be reopened, edited, versioned, and exported.
- Flow runs and RAG sources link back to artifacts.

### GOAL-002: Permissioned Tool and Connector Gateway

Unify built-in tools, MCP servers, OpenAPI tools, browser automation, and local commands behind one capability model.

**Done when:**

- Tools declare scopes: read files, write files, shell, browser, network read, external mutation, account action.
- Risky scopes require explicit approval before execution.
- Every tool call has a run ledger entry.
- LocAI can consume MCP tools and later expose selected LocAI tools as MCP.

### GOAL-003: Model Router and Provider Governance

Keep the existing provider abstraction but add routing, fallback, budgets, context metadata, and per-task recommendations.

**Done when:**

- Each provider/model has health, latency, context length, strengths, and cost metadata.
- A workflow can select "local/private", "fast", "deep reasoning", or "cheap" routing policy.
- Cloud fallback is explicit and logged.
- Optional LiteLLM integration is possible without replacing the native provider layer.

### GOAL-004: Skills and Custom Agents

Add reusable agent packages similar to Genspark Custom Agents, but local and inspectable.

**Done when:**

- A skill defines role, instructions, tools, model policy, inputs, output artifact type, and safety scopes.
- Users can invoke skills from chat via `@skill` or from Flow Builder nodes.
- Skills can be exported/imported as files.
- Existing flow templates can become skills where appropriate.

### GOAL-005: Deep Research Artifact Flow

Turn deep research into a structured product flow.

**Done when:**

- LocAI can create a research artifact with plan, source search, extraction, synthesis, citations, assumptions, open questions, and export.
- It can use local RAG, web search, uploaded documents, and model routing in one flow.
- Source provenance is visible and reusable in later docs/slides/sheets.

### GOAL-006: Docs, Sheets, Slides, and Reports

Build artifact modules before chasing every media format.

**Done when:**

- Docs: Markdown and rich text editing, AI edit on selection, savepoints, PDF/DOCX/HTML export.
- Sheets: XLSX/CSV import, formula/chart generation, data cleaning, insight report, XLSX export.
- Slides: outline first, style presets, source-backed deck generation, PPTX/PDF export.
- Reports: combine research + sheet + doc/deck artifacts into one deliverable.

### GOAL-007: Durable Workflows, Triggers, and Approvals

Upgrade flows from "run now" to "safe automation".

**Done when:**

- Workflows support manual, schedule, file-change, email/webhook, and future connector triggers.
- Test Run and Live Run are separate modes.
- Human approval checkpoints can pause/resume runs.
- Failed runs can retry from checkpoints.

### GOAL-008: Browser/Desktop Automation Sandbox

Add Genspark-Claw-like capabilities only behind hard boundaries.

**Done when:**

- Browser automation runs in an isolated profile with allowed domains and downloadable evidence.
- Local file automation is limited to selected workspace roots.
- Shell/terminal actions require declared command policy and approval class.
- The user can review actions before destructive/external effects.

### GOAL-009: Local Knowledge Operating System

Make documents, notes, memory, artifacts, and workflow runs one searchable knowledge layer.

**Done when:**

- Search spans artifacts, notes, docs, memory, conversations, and flow history.
- Results show source type, timestamp, relevance, and provenance.
- RAG uses hybrid retrieval and citation-ready chunks.
- Knowledge graph can include artifacts and workflows, not only notes.

### GOAL-010: Packaging and Daily Use

Make LocAI practical as a daily driver.

**Done when:**

- One-command dev/prod start stays reliable.
- Backup/restore includes projects/artifacts/connectors.
- Settings expose model, tool, and permission health.
- A small set of high-value workspace templates ships by default.

---

## Roadmap

### Phase 0: Decision Package

**Target:** 1-2 days  
**Purpose:** Freeze direction before implementation.

- [x] Pull latest repo.
- [x] Research Genspark and comparable local/self-hosted systems.
- [x] Write new goals roadmap.
- [x] Write ADRs for workspace direction, connector gateway, and artifact model.
- [ ] Create implementation branch after review.
- [ ] Open issues/tasks from GOAL IDs.

### Phase 1: Workspace Core and Safety

**Target:** 2-3 weeks  
**Purpose:** Build the substrate that all Genspark-class features need.

- Define `WorkspaceProject`, `Artifact`, `Savepoint`, `SourceRef`, and `RunLedger` types.
- Store projects under `~/.locai/projects/`.
- Add artifact list/detail UI.
- Add run ledger for all agent/tool calls.
- Add approval model for risky tool scopes.
- Add first "Research Brief" artifact type.

### Phase 2: Super Agent v1 Without Magic

**Target:** 2-4 weeks  
**Purpose:** One-prompt outcome generation using existing workflow infrastructure.

- Add supervisor planner that maps intent to a skill/workflow/artifact type.
- Add skills registry and `@skill` invocation.
- Convert top flow templates into skills.
- Add model policy: local/private, balanced, deep, cheap.
- Generate artifacts rather than only chat text.

### Phase 3: Deep Research and Document Production

**Target:** 3-5 weeks  
**Purpose:** First end-to-end Genspark-class outcome.

- Deep Research workflow: plan -> search -> extract -> synthesize -> fact-check -> artifact.
- Source manager with citations and reusable source cards.
- AI Docs module: Markdown-first editor, selection edit, savepoints, export.
- Report builder: research artifact -> formatted document.

### Phase 4: Data and Presentation Artifacts

**Target:** 4-6 weeks  
**Purpose:** Expand from text artifacts to business artifacts.

- Sheet artifact: CSV/XLSX ingestion, formula generation, chart metadata, insight summaries.
- Slide artifact: outline, style preset, source-backed sections, export path.
- Add "turn this research into deck/report/sheet" commands.
- Add artifact-to-artifact lineage view.

### Phase 5: Connectors, Triggers, and External Workflows

**Target:** 4-6 weeks  
**Purpose:** Move from manual runs to governed automation.

- MCP client support for local servers.
- OpenAPI tool import.
- Workflow triggers: schedule, webhook, file change.
- Test Run vs Live Run.
- Approval checkpoints for side effects.
- Optional n8n bridge for broad external integrations.

### Phase 6: Browser/Desktop Automation

**Target:** 4-8 weeks  
**Purpose:** Add Claw-like capabilities safely.

- Browser automation tool using an isolated profile and allowed domains.
- Local workspace file operation policies.
- Terminal command policy and review UX.
- Evidence capture: screenshots, DOM/text snapshot, command output, changed files.
- Destructive/external action gates.

### Phase 7: Daily Driver Polish

**Target:** ongoing  
**Purpose:** Make it boringly useful.

- Unified global search across artifacts, docs, notes, memory, runs.
- Better model/provider health dashboard.
- Backup/restore for projects and connectors.
- Workspace templates for research, project planning, CAD/CAM docs, market scans, reports.
- Performance audit after artifact/project layers land.

---

## First Implementation Slice

Recommended first slice after review:

1. Add project/artifact TypeScript types and filesystem store.
2. Add `/api/projects` and `/api/artifacts` CRUD.
3. Add a minimal `/workspace` UI with artifact list/detail.
4. Add a "Create Research Brief" workflow that writes an artifact.
5. Add run ledger entries for tool calls used by that workflow.

This creates the spine. Everything else can attach to it.

---

## Related ADRs

- `docs/adr/ADR-007-local-first-ai-workspace-platform.md`
- `docs/adr/ADR-008-permissioned-tool-connector-gateway.md`
- `docs/adr/ADR-009-artifact-project-model.md`

## Research Base

- `docs/research/genspark-local-ai-workspace-research-2026-06-17.md`
