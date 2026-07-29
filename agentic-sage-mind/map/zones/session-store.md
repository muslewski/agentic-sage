---
type: zone
summary: "Per-repo session record store, storage-root resolution, repo-id identity, enable flags, liveness/provenance, handoff sidecars, and prune — the persistence layer under `~/.claude/agentic-sage` (or project markers)."
tags: [storage, sessions, identity]
status: active
created: 2026-07-21
updated: 2026-07-29
verifiedAt: 4b132798
owns:
  routes: []
  testids: []
  globs:
    - "lib/store.mjs"
    - "lib/paths.mjs"
    - "lib/roots.mjs"
    - "lib/registry.mjs"
    - "lib/repo-id.mjs"
    - "lib/enabled.mjs"
    - "lib/provenance.mjs"
    - "lib/self.mjs"
    - "lib/prune.mjs"
    - "lib/handoff.mjs"
    - "lib/liveness.mjs"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

Atomic JSON session files (`mergeRecord` + mkdir lock), append-only events, path helpers, multi-rule storage resolution (`explainRepoDataDir` / markers / registry), `repo_id` hashing, global/project enable gates, nested-session provenance, self-sid resolution, handoff sidecar schema, pid liveness, and dead-record prune planning.

## Anchors

File-level globs under `lib/` partition persistence and identity away from render/TUI. Writers are both the emitter hook and the CLI (`claim`, `link`).

## Invariants

Prefer empty until verified. Store comments claim atomic tmp+rename writes and fail-open lock takeover so hooks never hang.

## Lineage

CONVENTIONS.md storage precedence (referenced by README), `lib/store.mjs` / `lib/roots.mjs` headers, SCHEMA.md session fields, 2026-07-21 atlas-seed pass.

## Dual registration bridge (2026-07-29)

- **Pull:** `lib/agent-status.mjs` reads Agent Status Provider records
  (`$AGENT_STATUS_DIR` → `$XDG_RUNTIME_DIR/agent-status` →
  `$HOME/.local/state/agent-status`) into **synthetic** session rows. Fail-open.
- **Push:** `lib/register.mjs` + `sage register` writes real records via
  `mergeRecord` (source `register`, managed_by `nested`). Soft-fail exits 0.
- **Precedence:** real record wins on pid collision; never field-merge.
- **Prune:** `pruneAll` walks every repo under sage home; dry-run default for
  `--all` unless `--yes`.

