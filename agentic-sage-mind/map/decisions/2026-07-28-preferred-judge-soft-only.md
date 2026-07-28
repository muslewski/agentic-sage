---
type: decision
summary: "judge.desired preferred is soft-only: SessionStart/doctor/gate warn when offline; never hard-fail; CLI-only remains first-class when optional."
tags: [preferred, gate, fail-open, live-judge]
status: accepted
created: 2026-07-28
updated: 2026-07-28
related:
  - "[[2026-07-23-live-judge-continuous-brief]]"
  - "[[2026-07-28-fleet-follow-preferred-judge-design]]"
---

# Preferred live judge is soft-only

## Context

Manjaro wants a living judge most of the time; npm users often want CLI-only. Atlas-style soft package freshness is the right UX pattern — not hard gates on coding.

## Decision

1. `judge.desired: "optional"` (default) — no offline-judge noise.
2. `judge.desired: "preferred"` — soft lines only when unsatisfied (no live judge and no attachable brief).
3. Surfaces: SessionStart, doctor detail, `sage gate`. Always exit 0 for preferred-offline.
4. `sage gate --strict` may fail install/freshness only — never preferred-offline.
5. No mid-flight PreToolUse/UserPrompt inject for preferred-offline in v1.

## Consequences

- Fleet can enable preferred via config/script without changing product law for others.
- Humans still start `sage judge run` (or fact keeper); no auto-spawn LLM.
- Atlas remains a peer; soft sibling lines only when both present.
