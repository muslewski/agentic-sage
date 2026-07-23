---
type: plan
summary: "Implement store-native live judge briefs, sage judge CLI, collision exclusion, consult attach, and sage-judge skill."
status: done
created: 2026-07-23
updated: 2026-07-23
related: []
sources:
  - "[[2026-07-23-live-judge-session-design]]"
---

# Live Judge Session Implementation Plan

> **For agentic workers:** Implement task-by-task. Checkboxes track progress.

**Goal:** Optional live judge sessions write continuous store-native briefs; consult verbs layer fresh briefs after deterministic facts.

**Architecture:** `lib/brief.mjs` owns paths/freshness/publish/render; session `role`/`judge_scope` via `mergeRecord`; territory/fleet/warfaces skip judges for collision; `bin/sage` adds `judge` subcommands + attach; skills document the loop.

**Tech Stack:** Node ≥20, zero deps, `node --test`.

## Global Constraints

- No LLM in core; fail-open; default-OFF; judges excluded from collision peers; one writer per brief slot; SCHEMA additive only.

---

### Task 1: `lib/brief.mjs` + paths

**Files:** Create `lib/brief.mjs`; modify `lib/paths.mjs`; test `test/brief.test.mjs`.

- [x] Atomic write/read fleet + repo briefs
- [x] `isBriefFresh`, `isJudge`, `renderBriefLayers`, `loadAttachableBriefs`
- [x] Tests for TTL, stale, dead judge, size cap

### Task 2: Collision exclusion

**Files:** `lib/territory.mjs`, `lib/fleet.mjs`, `lib/warfaces.mjs`; tests.

- [x] Skip `role === 'judge'` in territory/why/merge peers, contestedCount, contestedPaths, fleetLine nearest

### Task 3: CLI `sage judge *` + attach

**Files:** `bin/sage`, `SCHEMA.md`; tests `test/judge-cli.test.mjs`.

- [x] on/off/status/show/publish + takeover
- [x] Attach layers on consult verbs; `--no-brief`; JSON `briefs`

### Task 4: Board/war visibility

**Files:** `lib/board.mjs`, `lib/fleet.mjs` totals optional `judges`.

- [x] Status chip for judge sessions
- [x] `totals.judges` on war/fleet collect

### Task 5: Skills

**Files:** `skills/sage-judge/SKILL.md`, `skills/sage-fleet/SKILL.md`.

- [x] Full judge loop skill; fleet delta on brief authority

### Task 6: Atlas + verify

- [x] Zone/decision notes if claims change; `node --test` green (476 pass)
