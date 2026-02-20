# Changelog

## [Unreleased]

### Added
- **Multi-Provider Support**: Chat agent and workflow engine now support Anthropic (Claude), OpenAI, and OpenRouter alongside Ollama
- `POST /api/chat/agent` accepts `provider` and `model` parameters to select LLM provider
- `POST /api/chat/agent/workflow` supports provider selection for all workflow steps
- `GET /api/models` endpoint to list available models across all configured providers
- `src/lib/providers/server.ts` — server-side provider factory (reads API keys from env)
- Provider integration guide: `docs/PROVIDER-INTEGRATION.md`

### Changed
- Agent executor (`src/lib/agents/executor.ts`) refactored to use provider-agnostic `ChatProvider` interface instead of direct Ollama calls
- Workflow engine (`src/lib/agents/workflow.ts`) uses `ChatProvider` interface
- All existing Ollama-based functionality remains backward-compatible (default provider)
