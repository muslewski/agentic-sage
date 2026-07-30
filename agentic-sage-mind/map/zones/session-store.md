---
type: zone
summary: "Per-repo session record store with path containment, storage-root resolution, repo-id/worktree identity, enable flags, liveness/provenance, handoff sidecars, and prune — under `~/.claude/agentic-sage` (or project markers)."
tags: [storage, sessions, identity]
status: active
created: 2026-07-21
updated: 2026-07-30
verifiedAt: c253ffd2
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

File-level globs under `lib/` partition persistence and identity away from render/TUI. Writers are both the emitter hook and the CLI (`claim`, `link`, `register`).

## Invariants

- Atomic tmp+rename writes; fail-open lock takeover so hooks never hang.
- Session ids must be path-safe (`isSafeSessionId`); unsafe sids refuse write.
- Writes under a repo data dir must realpath-contain — sessions/ symlink escape is refused.
- Readers skip non-files (FIFO under sessions/ must not hang board).
- `resolveRepoRoot` uses absolute `--git-common-dir` (`.git` parent, else common dir itself for relocated gitdirs). `resolveWorktreeRoot` is `--show-toplevel` so nested worktrees keep distinct `worktree` paths on register.

## Lineage

CONVENTIONS.md storage precedence (referenced by README), `lib/store.mjs` / `lib/roots.mjs` headers, SCHEMA.md session fields, 2026-07-21 atlas-seed pass.

## Dual registration bridge (2026-07-29)

- **Pull:** `lib/agent-status.mjs` reads Agent Status Provider records
  (`$AGENT_STATUS_DIR` → `$XDG_RUNTIME_DIR/agent-status` →
  `$HOME/.local/state/agent-status`) into **synthetic** session rows. Fail-open.
- **Push:** `lib/register.mjs` + `sage register` writes real records via
  `mergeRecord` (source `register`, managed_by `nested`). Exit: **0** success,
  **1** soft-fail (not a repo / store / unknown sid), **2** usage/unsafe sid.
- **Precedence:** real record wins on pid collision; never field-merge.
- **Prune:** `pruneAll` walks every repo under sage home; dry-run default for
  `--all` unless `--yes`.

