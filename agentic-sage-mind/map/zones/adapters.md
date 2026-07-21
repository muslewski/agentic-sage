---
type: zone
summary: "Optional per-repo adapter contract — discovery/load of `.agentic-sage/adapter.mjs`, fail-closed-to-core enrichment (`ownsZone`/`claimedWork`/`backlogRows`), plus shipped `adapters/template.mjs` and worked-example `adapters/acme.mjs`."
tags: [adapters, optional, project]
status: seeded
created: 2026-07-21
updated: 2026-07-21
verifiedAt: unverified
owns:
  routes: []
  testids: []
  globs:
    - "lib/adapter.mjs"
    - "adapters/**"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

The universal-core vs project boundary: without an adapter, board/territory still work on paths and branches. With one, sessions gain named zones and backlog rows. Loader searches repo `.agentic-sage/adapter.mjs`, legacy `.sage/`, then state dir; any import/error degrades to null (never crashes the CLI).

## Anchors

- `lib/adapter.mjs` — path discovery + dynamic import + zoneOf/rowOf
- `adapters/template.mjs` — scaffold for `sage adapter init`
- `adapters/acme.mjs` — non-required worked example (this author's conventions)

## Invariants

Prefer empty until verified. Trust model in file comments: adapter is the human's own code; fail-closed-to-core, not sandboxed.

## Lineage

ADAPTERS.md, README "Universal core vs your project", adapter.mjs header, 2026-07-21 atlas-seed pass.
