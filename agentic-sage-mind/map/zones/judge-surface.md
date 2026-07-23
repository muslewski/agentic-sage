---
type: zone
summary: "Read-side fleet judge — board roster, cross-repo fleet/repos HUD, territory/why-diverged/merge-brief collision checks, git numstat signals, backlog claim rows, asking stamps, optional live-judge brief attach, doctor/control, and optional PreToolUse guard policy."
tags: [board, territory, fleet, guard, live-judge]
status: seeded
created: 2026-07-21
updated: 2026-07-21
verifiedAt: unverified
owns:
  routes: []
  testids: []
  globs:
    - "lib/board.mjs"
    - "lib/fleet.mjs"
    - "lib/territory.mjs"
    - "lib/git.mjs"
    - "lib/backlog.mjs"
    - "lib/asking.mjs"
    - "lib/control.mjs"
    - "lib/guard.mjs"
    - "lib/brief.mjs"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

Universal-core answers to "who is doing what" and "am I about to collide": collect/partition sessions, render board lines, fleet one-liners and repos atlas, glob-overlap territory, cross-branch why-diverged / merge-brief, git worktree signals, backlog row helpers, "Asking Sage" statusline stamps, doctor checks + on/off/link control, the default-OFF guard path matcher (emitter enforces), and optional **live judge** continuous briefs (`lib/brief.mjs`, `sage judge *`) layered on consult output when a special session has published a fresh brief. Core stays deterministic; the live session is the optional reasoning mind.

## Anchors

These modules implement CLI verbs without owning the argv switch (`cli` zone). Collision tools consider only live liveness buckets (`working`/`idle`/`stalled`) per SCHEMA.md.

## Invariants

Prefer empty until verified. Product claim: live-only collision surface; dead/closed history must not cry wolf.

## Lineage

README "How it works" + SCHEMA.md envelope notes + lib headers, 2026-07-21 atlas-seed pass.
