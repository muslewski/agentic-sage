---
type: decision
summary: "init --repair creates the resolved per-repo storage directory so doctor’s storage-dir remedy is truthful."
status: accepted
date: 2026-07-30
---

# init --repair creates per-repo storage dir

## Context

`sage doctor` marked **storage dir** ✗ with `→ run: sage init --repair` when
`repos/<repo_id>` was absent. Global `init --repair` only re-ran `wireAll`
(hooks/skills/home), so the hint looped. The directory actually appeared on
first session write (`register` / `mergeRecord`).

## Decision

Preference order for the dogfood finding: make the documented remedy true.
On global-scope `sage init --repair`, when cwd resolves to a git main root,
`mkdirSync` the path from `explainRepoDataDir` (same dir doctor checks).
Project-scope repair already created it via `wireProject`.

Doctor exit code stays **0**. Empty dir is a healthy storage row.

## Alternatives rejected

- Soften storage ✗ to “expected pre-first-use” — weaker: a remedy that does
  not work is worse than no remedy; design already said repair recreates
  missing dirs.
- Create `repos/<id>` on every plain `init --global` — not required to break
  the doctor loop; repair remains the explicit fix path doctor prints.

## Consequences

Docs (`getting-started`, troubleshooting, `cli` `--repair` row) can keep
pointing at `sage init --repair` for missing storage. Clone-from-source still
needs `node bin/sage` until PATH/link.
