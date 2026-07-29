---
type: zone
summary: "Read-side fleet judge — board/fleet/war/territory, optional live-judge briefs, judge.desired preferred|optional soft offline probe, doctor/gate control, guard default-OFF."
tags: [board, territory, fleet, guard, live-judge, preferred]
status: active
created: 2026-07-21
updated: 2026-07-29
verifiedAt: b71038d0
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
    - "lib/judge-desired.mjs"
    - "lib/gate.mjs"
    - "lib/package-freshness.mjs"
    - "lib/install-state.mjs"
    - "lib/telemetry.mjs"
    - "lib/fleet-devlog.mjs"
    - "test/fleet-devlog.test.mjs"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

Universal-core answers to "who is doing what" and "am I about to collide": collect/partition sessions, render board lines, fleet one-liners and repos atlas, glob-overlap territory, cross-branch why-diverged / merge-brief, git worktree signals, backlog row helpers, "Asking Sage" statusline stamps, doctor checks + on/off/link control, the default-OFF guard path matcher (emitter enforces), and optional **live judge** continuous briefs (`lib/brief.mjs`, `sage judge *`) layered on consult output when a special session has published a fresh brief. Core stays deterministic; the live session is the optional reasoning mind.

**Fleet-follow (2026-07-28):** `judge.desired` is `optional` (product default — no offline noise) or `preferred` (soft warn on SessionStart / doctor / `sage gate` when no live judge and no attachable brief). Preferred-offline never fails exit codes. `sage gate` also reports install freshness (wired stamp + npm latest).

## Anchors

These modules implement CLI verbs without owning the argv switch (`cli` zone). Collision tools consider only live liveness buckets (`working`/`idle`/`stalled`) per SCHEMA.md.

## Invariants

Prefer empty until verified. Product claim: live-only collision surface; dead/closed history must not cry wolf.

## Lineage

README "How it works" + SCHEMA.md envelope notes + lib headers, 2026-07-21 atlas-seed pass.

## Fleet-devlog (W7)

`lib/telemetry.mjs` also emits fleet-devlog v1 (vendored `lib/fleet-devlog.mjs`)
to `$XDG_STATE_HOME/fleet-devlog/events.jsonl` when opted in — same
`install_id` as the other fleet tools. Legacy `~/.cache/agentic-sage/events.jsonl`
keeps its own install-id and `hashRepoRoot` scheme; fleet events use
`resolveRepoId` (`basename-sha2568` of the main root).

