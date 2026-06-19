# Goals: Frontier Models via OAuth-Capable Providers

**Date:** 2026-06-19  
**Baseline commit:** `a1cc584 feat: connect workflow runs to workspace artifacts`  
**Purpose:** Make LocAI usable with current frontier models without making static API keys the only path.

---

## Research Summary

LocAI already has the right core shape: provider abstraction, per-request provider/model routing, Flow Builder provider overrides, and server-side credential handling. The missing part is credential governance. Before this slice, every non-local provider was treated as "API key or unavailable".

Current provider reality is uneven:

- OpenRouter supports OAuth PKCE for local/localhost apps and exchanges the OAuth code for a user-controlled API key. That is the most practical single OAuth path for GPT, Claude, Gemini, and other frontier models through LocAI. Source: https://openrouter.ai/docs/guides/overview/auth/oauth
- OpenRouter authenticates API calls with Bearer tokens and can be used through OpenAI-compatible SDKs/endpoints. Source: https://openrouter.ai/docs/api/reference/authentication
- Google Gemini API supports OAuth bearer tokens in addition to API keys. The documented local path uses Application Default Credentials and sends `Authorization: Bearer ...` plus `x-goog-user-project`. Source: https://ai.google.dev/gemini-api/docs/oauth
- Gemini's current model page lists Gemini 3/3.5 family models and explicitly distinguishes stable, preview, latest, and experimental model aliases. Source: https://ai.google.dev/gemini-api/docs/models
- OpenAI's public API docs still describe API keys as the standard API credential, and Workload Identity Federation as the short-lived-token path for workloads. Source: https://developers.openai.com/api/docs/guides/production-best-practices and https://developers.openai.com/api/docs/guides/workload-identity-federation
- OpenAI's current model docs recommend GPT-5.5 for complex reasoning/coding and list GPT-5.4 mini/nano as lower-cost/latency options. Source: https://developers.openai.com/api/docs/models
- Anthropic explicitly says Claude Code OAuth is for native Anthropic apps/subscriptions and third-party products should use API keys or supported cloud providers. Source: https://code.claude.com/docs/en/legal-and-compliance
- Anthropic's current model overview lists Claude Fable 5, Claude Opus 4.8, Sonnet 4.6, and Haiku 4.5 as current model families. Source: https://platform.claude.com/docs/en/about-claude/models/overview

Implication: LocAI should support OAuth where providers officially allow it, avoid routing Claude.ai/ChatGPT consumer OAuth through unsupported paths, and make credential type visible in `/settings`.

---

## What Was Missing

- Provider credential model only represented API keys.
- `/api/models` and provider health did not expose credential mode/source metadata.
- OpenRouter OAuth PKCE had no local callback/store path.
- Google Gemini was not a first-class provider.
- Model defaults and fallback examples still pointed to older GPT-4o / Claude 2025 model IDs.
- Docs did not explain the difference between API key, OAuth, and workload identity for frontier providers.

---

## Implemented In This Slice

- [x] Added provider auth modes: `api_key`, `oauth`, `workload_identity`, `none`.
- [x] Added server-side credential resolution with explicit priority: request override -> env -> local OAuth store.
- [x] Added local OpenRouter OAuth PKCE start/callback/disconnect routes.
- [x] Added a local provider credential store under `~/.locai/provider-credentials.json`.
- [x] Added Google Gemini provider using REST `generateContent`, model listing, OAuth bearer/API-key auth, and basic function-call extraction.
- [x] Added `google` to provider types, Flow Builder config, Notes AI actions, fallback UI labels, and provider health.
- [x] Exposed provider auth metadata from `/api/models` and `/api/providers/health`.
- [x] Updated current frontier fallback model IDs for OpenAI, Anthropic, OpenRouter, and Gemini.
- [x] Added focused unit tests for credential resolution and Gemini provider behavior.

---

## Follow-Up Goals

### PROV-OAUTH-002: Direct OpenAI Responses API Path

**Status:** proposed

OpenAI's latest model guidance prefers the Responses API for GPT-5.5 reasoning/tool-heavy workflows. LocAI's OpenAI-compatible provider still uses Chat Completions. Add a direct OpenAI Responses adapter before making `gpt-5.5` the default for direct OpenAI agent workflows.

Done when:

- Direct OpenAI provider can use Responses API for GPT-5+ models.
- Tool calls are mapped from Responses output items into LocAI's `ToolCallRequest`.
- Streaming handles Responses events or degrades explicitly.
- Existing OpenRouter/OpenAI-compatible provider path remains unchanged.

### PROV-OAUTH-003: Google OAuth Manager UI

**Status:** proposed

Google OAuth currently accepts environment/local-store bearer tokens. A full browser OAuth manager needs Google OAuth client configuration, refresh-token handling, and consent-screen guidance.

Done when:

- Settings can import Google OAuth client config locally.
- User can connect/disconnect Gemini OAuth without manually exporting access tokens.
- Refresh tokens are stored locally with restrictive file permissions.
- `x-goog-user-project` is validated before model calls.

### PROV-GOV-001: Provider Policy Router

**Status:** proposed

Now that credential modes are visible, routing should become policy-aware instead of just user-selected.

Done when:

- Models expose cost/privacy/tool/long-context metadata.
- Chat and Workflow can choose `local`, `balanced`, `frontier`, or `cheap` policy.
- Fallback events include credential mode and provider/source metadata.
- UI warns before switching from local/private to cloud providers.
