---
type: zone
summary: "The `sage` / `agentic-sage` CLI entry (`bin/sage`) — dispatches board, war, fleet, territory, claim, init, doctor, and other fleet-judge verbs over lib/*."
tags: [cli, entrypoint]
status: seeded
created: 2026-07-21
updated: 2026-07-21
verifiedAt: unverified
owns:
  routes: []
  testids: []
  globs:
    - "bin/sage"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

Single Node shebang binary that is the public command surface of SAGE. It resolves the repo from cwd, loads optional adapters, and routes argv to judge reads (board/fleet/territory/war), session control (on/off/enable/claim), install (`init`), and doctor.

## Anchors

`bin/sage` is the only package `bin` target (`sage` and `agentic-sage` aliases in package.json). Tests live under `test/cli.test.mjs` (owned by no zone; product surface is the binary).

## Invariants

Prefer empty until verified. Known product claims (from README): read-mostly; fail-open outside a git repo.

## Lineage

Inferred from package.json `bin`, README quickstart, and `bin/sage` switch dispatch on 2026-07-21 atlas-seed pass.
