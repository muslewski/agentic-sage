---
type: decision
summary: "hasLiveJudgeSession always skips Agent Status Provider synthetics; preferred-offline probes check briefs before the multi-repo walk so sage gate stays soft and fast."
status: accepted
created: 2026-07-30
updated: 2026-07-30
related:
  - "[[judge-surface]]"
  - "[[session-store]]"
sources: []
---

# Preferred probe skips synthetic merge

## Context

After the Agent Status Provider bridge landed, `hasLiveJudgeSession` called full `collectSessions` for every repo under sage home. On a busy machine that re-resolved hundreds of launcher records per repo and made `sage gate` / SessionStart preferred-offline probes hang for minutes while preferred stayed soft-only by design.

## Decision

1. **`noSynthetic: true` always** when scanning for live judges — `role=judge` is an emitter field on real sessions; synthetics never carry it.
2. **Briefs first** in `isJudgeDesireSatisfied` — O(1) fleet/repo brief reads before the multi-repo walk.
3. **No change** to product default (`optional` / preferred soft-only) or guard default-OFF.

## Consequences

- `sage gate` returns in ~100–200ms on a 100+ repo home instead of multi-minute hangs.
- Board/fleet still merge synthetics for visibility; only the preferred-offline probe skips them.
- SessionStart soft lines no longer risk blocking the harness hook path on dense fleets.
