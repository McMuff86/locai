# Contributing to LocAI

Thanks for wanting to contribute! LocAI is developed with an AI-assisted multi-agent workflow (described below), but human contributions are very much welcome.

---

## 🌿 Branch Convention

All feature branches follow this pattern:

```
<type>/<short-description>
```

| Type prefix | When to use |
|-------------|-------------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Code restructuring |
| `test/` | Tests and fixtures |
| `ui/` | Design, animations, polish |
| `docs/` | Documentation |
| `chore/` | Build, deps, config |

**Examples:**
```bash
feat/workflow-engine
fix/chat-duplicate-messages
ui/chat-redesign
test/agent-tools
docs/readme-update
```

Create your branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature
```

---

## 📝 Commit Message Format

```
<type>(<scope>): <short description>

[optional body]
```

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `chore` | Build, deps, config |
| `ui` | Styling, animations, visual changes |

**Examples:**
```
feat(agent): add reflection step after tool execution
fix(rag): handle empty chunk list on search
docs(claude): update agent mode documentation
ui(chat): smooth scroll-to-bottom animation
test(executor): add timeout edge case coverage
```

Keep the subject line under 72 characters. Reference issues if relevant (`Closes #42`).

---

## 🔒 PR Process

`main` is protected. All changes go through PRs.

1. **Create your branch** (see above)
2. **Make your changes** — keep commits focused and atomic
3. **Run preflight** before pushing:
   ```bash
   npm run preflight
   # = lint + typecheck + test + build
   # All must pass. No exceptions.
   ```
4. **Push your branch:**
   ```bash
   git push origin sprint5/your-feature
   ```
5. **Open a PR** against `main`
   - Clear title following commit format
   - Describe what changed and why
   - Link related issues if any
6. **Address review feedback** — squash fixup commits before merge

**No force-pushing to `main`.** Rebase your branch before merging if needed.

---

## 🤖 AI Agent Instructions

If you're an AI coding agent, read [`AGENTS.md`](AGENTS.md) for project architecture, conventions, and important paths.

For session handoff context, see [`docs/CONTEXT-HANDOFF.md`](docs/CONTEXT-HANDOFF.md).

---

## 🎨 Code Style

### TypeScript

- **Strict mode** is enabled — no `@ts-ignore` without a comment explaining why
- Prefer explicit types over `any` (ESLint will warn)
- Use `interface` for object shapes, `type` for unions/intersections
- No barrel exports that cause circular dependencies

### React / Next.js

- **Server Components** by default — only add `"use client"` when you actually need browser APIs or state
- Custom hooks in `src/hooks/` — keep them focused on one concern
- API routes in `src/app/api/` — validate all inputs, use `assertLocalRequest()` for mutating endpoints

### Tailwind CSS

- Use Tailwind utility classes — no custom CSS unless absolutely necessary
- Follow the existing class ordering (layout → spacing → typography → color → interactive)
- Dark mode via `dark:` variants, not separate class blocks

### Shadcn/UI

- Use existing components from `src/components/ui/` before reaching for custom HTML
- Add new Shadcn components via `npx shadcn-ui add <component>` — don't hand-roll them

### File Organization

```
src/
├── app/            # Next.js routes and API routes
├── components/     # React components (feature-grouped)
├── hooks/          # Custom React hooks
├── lib/            # Business logic, utilities, domain code
└── types/          # Shared TypeScript types
```

Keep components small. If a file exceeds ~300 lines, consider splitting.

---

## 🧪 Test Requirements

**All tests must pass before merging.** No exceptions.

```bash
npm run preflight    # Full check: lint + typecheck + test + build
npm run test         # Just Vitest tests
npm run typecheck    # Just TypeScript
npm run lint         # Just ESLint
```

### Test Location

Tests live alongside the code they test or in `__tests__/` directories:

```
src/lib/agents/__tests__/executor.test.ts
src/lib/agents/__tests__/textToolParser.test.ts
```

### What to Test

- **Agent tools:** Input validation, error cases, sandboxing behavior
- **RAG pipeline:** Chunking, search ranking
- **Security utils:** Path traversal rejection, local-only guard
- **UI components:** Snapshot tests for complex components (Vitest + React Testing Library)

When adding a new feature, add tests. When fixing a bug, add a regression test.

---

## 🔐 Security Notes

- **Path traversal:** All file operations must use `validatePath()` from `src/app/api/_utils/security.ts`
- **Local-only mutations:** Use `assertLocalRequest()` on any endpoint that writes data
- **Agent sandboxing:** `run_command` and `run_code` are restricted to the workspace directory
- **No secrets in code:** Don't hardcode tokens, passwords, or API keys

---

## 💬 Questions?

Open an issue or start a discussion. If it's urgent and you're an AI agent — update `CONTEXT-HANDOFF.md` with your question so the next session picks it up.
