---
type: zone
summary: "Read-side fleet judge — board/fleet/war/territory, optional live-judge briefs, judge.desired preferred|optional soft offline probe, doctor/gate control (gate local-only by default), guard default-OFF."
tags: [board, territory, fleet, guard, live-judge, preferred]
status: active
created: 2026-07-21
updated: 2026-07-30
verifiedAt: d5ccf86b
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
    - "lib/telemetry.mjs"
    - "lib/fleet-devlog.mjs"
    - "test/fleet-devlog.test.mjs"
    - "test/judge-desired.test.mjs"
    - "test/gate.test.mjs"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

Universal-core answers to "who is doing what" and "am I about to collide": collect/partition sessions, render board lines, fleet one-liners and repos atlas, glob-overlap territory, cross-branch why-diverged / merge-brief, git worktree signals, backlog row helpers, "Asking Sage" statusline stamps, doctor checks + on/off/link control, the default-OFF guard path matcher (emitter enforces), and optional **live judge** continuous briefs (`lib/brief.mjs`, `sage judge *`) layered on consult output when a special session has published a fresh brief. Core stays deterministic; the live session is the optional reasoning mind.

**Fleet-follow (2026-07-28):** `judge.desired` is `optional` (product default — no offline noise) or `preferred` (soft warn on SessionStart / doctor / `sage gate` when no live judge and no attachable brief). Preferred-offline never fails exit codes. `sage gate` reports install freshness via the **wired stamp by default**; npm registry comparison is opt-in (`sage gate --check-latest` or `packageFreshness.registry: true`) — see decision `2026-07-30-gate-local-by-default`.

**Preferred probe cost (2026-07-30):** `hasLiveJudgeSession` walks every repo under sage home but always passes `noSynthetic: true` — judges are real `role=judge` emitter sessions, never Agent Status Provider rows. Merging agent-status on every repo re-resolved hundreds of launcher records and hung `sage gate` / SessionStart preferred-offline probes on busy machines. `isJudgeDesireSatisfied` checks attachable briefs first (O(1) file reads) before the multi-repo live-judge walk.

**Collision surface (2026-07-30):** synthetic agent-status rows appear on board/fleet/war but are excluded from territory / why-diverged / merge-brief. `mergeBrief` unions `claimed_globs` and `touched_globs` so claim-only overlaps still contest.

**Both-glob prefix boundary (2026-07-30 reconcile):** both-glob `overlaps` uses path-segment-aware static prefixes — `nested/**` does not collide with `nested-inner/**` (plain `startsWith` used to poison nested-worktree territory).

**Gate freshness side-effect (2026-07-30 reconcile):** `computePackageFreshness` caches npm latest only when the sage home directory already exists; a "sage home missing" gate warning must not be contradicted by creating `state.json`.

## Anchors

These modules implement CLI verbs without owning the argv switch (`cli` zone). Collision tools consider only live liveness buckets (`working`/`idle`/`stalled`) per SCHEMA.md.

## Invariants

Prefer empty until verified. Product claim: live-only collision surface; dead/closed history must not cry wolf.

## Lineage

README "How it works" + SCHEMA.md envelope notes + lib headers, 2026-07-21 atlas-seed pass.

## Synthetic sessions on the board (2026-07-29)

`collectSessions` / `collectFleet` merge launcher-declared children from the
Agent Status Provider. Synthetic rows appear on board/fleet/war for visibility
but are **excluded** from territory, why-diverged, and merge-brief (no verified
file ownership). LIVE rollup (`lib/rollup.mjs`) collapses by lane/parent past a
viewport budget so 60–138 peers stay readable.

## Fleet-devlog (W7)

`lib/telemetry.mjs` also emits fleet-devlog v1 (vendored `lib/fleet-devlog.mjs`)
to `$XDG_STATE_HOME/fleet-devlog/events.jsonl` when opted in — same
`install_id` as the other fleet tools. Legacy `~/.cache/agentic-sage/events.jsonl`
keeps its own install-id and `hashRepoRoot` scheme; fleet events use
`resolveRepoId` (`basename-sha2568` of the main root).

**Reference path (2026-07-30):** portable default. `referencePath()` returns
`FLEET_DEVLOG_REF` when set, else this module (`import.meta.url`) — never a
hardcoded desk path. Vendored byte-identical with work-kb
`contracts/fleet-devlog.reference.mjs`. Drift tests fail loudly when the env
points at a missing file; visible `t.skip` only when no sibling reference is
discoverable.


