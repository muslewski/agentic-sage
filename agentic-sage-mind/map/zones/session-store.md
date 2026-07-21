---
type: zone
summary: "Per-repo session record store, storage-root resolution, repo-id identity, enable flags, liveness/provenance, handoff sidecars, and prune — the persistence layer under `~/.claude/agentic-sage` (or project markers)."
tags: [storage, sessions, identity]
status: seeded
created: 2026-07-21
updated: 2026-07-21
verifiedAt: unverified
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
