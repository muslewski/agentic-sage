---
type: zone
summary: "Fail-open lifecycle emitter hook (`hooks/agentic-sage-emit.mjs`) — records SessionStart/PostToolUse/Stop/PreCompact/SessionEnd and optionally gates PreToolUse; default-OFF, never blocks the harness on error."
tags: [hooks, emitter, fail-open]
status: seeded
created: 2026-07-21
updated: 2026-07-21
verifiedAt: unverified
owns:
  routes: []
  testids: []
  globs:
    - "hooks/agentic-sage-emit.mjs"
    - "lib/throttle.mjs"
    - "lib/stdin.mjs"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

The single hook entry wired into Claude/Grok settings. It ingests harness JSON on stdin (deadline-bounded), writes per-session records and event log lines, refreshes git signals and liveness, dumps PreCompact handoff sidecars, and is the only path that can `exit 2` when the optional guard is armed.

## Anchors

- `hooks/agentic-sage-emit.mjs` — hook process
- `lib/throttle.mjs` — PostToolUse ~1/30s throttle so hot paths stay cheap
- `lib/stdin.mjs` — deadline stdin read shared with CLI TTY paths

## Invariants

Documented in the hook header (not yet stamped as zone invariants): **fail-open** (errors → exit 0) and **default-OFF** (no config → cheap no-op before git/fs writes).

## Lineage

README "What install.mjs wires", hook file header comments, 2026-07-21 atlas-seed pass.
