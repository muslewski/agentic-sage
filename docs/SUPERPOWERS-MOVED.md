# `docs/superpowers/` moved

Agent design specs and implementation plans live in the **memory-atlas** vault
(same convention as Syndcast: specs/plans under the mind, not under public `docs/`).

| Old path | New path |
|----------|----------|
| `docs/superpowers/specs/*` | [`agentic-sage-mind/specs/`](../agentic-sage-mind/specs/) |
| `docs/superpowers/plans/*` | [`agentic-sage-mind/plans/`](../agentic-sage-mind/plans/) |

Pipeline for agents (see root `CLAUDE.md` / `AGENTS.md`):

- brainstorming / design → `agentic-sage-mind/specs/`
- writing-plans → `agentic-sage-mind/plans/`
- public product docs → `docs/` (this tree: guide, reference, recipes)

Do not recreate `docs/superpowers/`.

Also moved (internal, not public SSG):

| Old path | New path |
|----------|----------|
| `docs/dogfood-log.md` | `agentic-sage-mind/reports/dogfood-log.md` |
| `docs/launch/*` | `agentic-sage-mind/reports/launch/` |
| `docs/awesome-*` | `agentic-sage-mind/reports/submissions/` |
