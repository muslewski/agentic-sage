---
type: plan
summary: "Implement fleet-follow preferred judge: S1 probe/doctor/SessionStart, S2 gate+freshness, S3 telemetry, S4 fleet scripts, S5 atlas soft line."
tags: [fleet, gate, telemetry, preferred-judge]
status: done
created: 2026-07-28
updated: 2026-07-28
spec: "[[2026-07-28-fleet-follow-preferred-judge-design]]"
---

# Plan: fleet-follow preferred judge

## Task checklist

### S1 — Desired + probe + doctor + SessionStart

- [x] Add `lib/judge-desired.mjs`: `readJudgeDesired`, `isJudgeDesireSatisfied`, `preferredOfflineLine`
- [x] Wire doctor live-judge row to probe (always `ok: true`, detail varies)
- [x] SessionStart: after fleetLine, if preferred+warn+unsatisfied → second soft line
- [x] Tests: `test/judge-desired.test.mjs`, extend `test/control.test.mjs`, emit test if needed

### S2 — Gate + install freshness

- [x] Add `lib/install-state.mjs`: read/write `state.json`, `packageVersion()`, `stampWired`
- [x] Add `lib/package-freshness.mjs`: Tier A/B for agentic-sage global
- [x] Stamp wired on `wireAll` / `wireProject` success in `lib/wiring.mjs`
- [x] Add `lib/gate.mjs` + `bin/sage` case `gate`
- [x] Tests: `test/package-freshness.test.mjs`, `test/gate.test.mjs`

### S3 — Telemetry

- [x] Add `lib/telemetry.mjs` (atlas pattern, sage package name/paths)
- [x] Track finished CLI cmds in `bin/sage` finally (skip telemetry subcmd + statusline if needed)
- [x] `sage telemetry status|report|dump|clear|on|off`
- [x] Tests: `test/telemetry.test.mjs`

### S4 — Fleet scripts

- [x] `scripts/fleet-wire-preferred-judge.mjs`
- [x] `scripts/fleet-drop-atlas-adapter.mjs`
- [x] Docs: SETUP or recipe one-liner for preferred desk
- [x] CHANGELOG Unreleased entries

### S5 — Atlas soft sibling (optional same PR or follow-up)

- [x] memory-atlas: soft line in doctor/status when sage on PATH + vault + no adapter
- [x] Spec note or CHANGELOG in memory-atlas

### Verify

- [x] `npm test` green in agentic-sage
- [x] Manual: `sage doctor`, `sage gate`, preferred offline/online
- [x] Recollection: zones judge-surface, install-wiring, emitter; decision if needed; `atlas build`
