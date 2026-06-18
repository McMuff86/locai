# ADR-008: Permissioned Tool and Connector Gateway

**Status:** Proposed  
**Date:** 2026-06-17  
**Context:** Genspark-class workflows require many tools and connectors, but LocAI must not give agents uncontrolled access to local files, shell, browser, accounts, or external services.

---

## Context

LocAI already has built-in agent tools for documents, web search, file operations, notes, memory, shell/code execution, image generation, PDFs, Excel, music, and TTS.

The next step is larger:

- MCP servers for local and third-party tools.
- OpenAPI-imported tools.
- Browser automation.
- Workflow triggers.
- Optional external account actions.
- LocAI tools exposed to other AI clients.

Without a gateway, these capabilities will become inconsistent and unsafe. Each tool would implement its own permission behavior, logging, retries, and UI state.

---

## Decision

LocAI will introduce a **Tool and Connector Gateway** between agents/workflows and all executable capabilities.

The gateway will register every tool with:

- `id`
- `name`
- `description`
- `inputSchema`
- `outputSchema`
- `source`: `builtin | mcp | openapi | local-command | browser | external-service`
- `capabilities`
- `riskLevel`
- `approvalPolicy`
- `timeoutMs`
- `retryPolicy`
- `auditRedaction`

Capability scopes:

- `read_local_files`
- `write_local_files`
- `delete_local_files`
- `network_read`
- `external_write`
- `account_action`
- `shell_command`
- `code_execution`
- `browser_read`
- `browser_action`
- `secret_access`

Approval classes:

- `none`: safe read-only local operations.
- `session`: user approves once for the current run/session.
- `per_call`: user approves each action.
- `blocked`: not executable until manually enabled in settings.

All tool calls must produce a **Run Ledger** entry:

- request summary
- tool id and source
- capability scopes
- approval decision
- start/end timestamp
- success/failure
- changed files or external side effects when known
- redacted arguments/results

---

## MCP Strategy

LocAI should support MCP in two directions:

1. **MCP Client**
   - Import tools from local MCP servers.
   - Map MCP tools to LocAI gateway entries.
   - Apply LocAI approval and ledger rules on top.

2. **MCP Server**
   - Expose selected LocAI tools/artifacts to external AI clients.
   - Default off.
   - User chooses which tools/projects are visible.

MCP is a connector protocol, not a safety model. LocAI's gateway remains the safety boundary.

---

## Browser and Desktop Automation

Browser/desktop-like automation must be added as a gateway source, not as raw unrestricted agent power.

Rules:

- Browser tools run in isolated profiles.
- Domains can be allowlisted per run.
- Screenshots/text snapshots are saved as evidence.
- Downloads are routed to the selected project workspace.
- Form submissions, purchases, messages, emails, posts, account changes, and destructive operations require approval.
- Local file operations are limited to selected workspace roots.

---

## Consequences

### Positive

- Built-in tools, MCP, OpenAPI, shell, and browser automation share one governance model.
- Risky actions are reviewable and auditable.
- Flow Builder can show tool scopes before a workflow runs.
- Future connectors do not need custom safety logic from scratch.

### Negative

- More infrastructure before adding connectors.
- Some workflows will feel slower because approvals interrupt execution.
- Tool schemas and capability classification must be maintained carefully.

### Follow-Up

- Add a tool registry UI in Settings.
- Add approval UI components reusable by Chat and Flow.
- Add run ledger storage under the project/artifact model.
- Add import path for local MCP servers after gateway basics exist.

---

## Related

- `docs/adr/ADR-007-local-first-ai-workspace-platform.md`
- `docs/adr/ADR-009-artifact-project-model.md`
- `docs/goals/2026-06-genspark-class-local-ai-workspace-roadmap.md`
