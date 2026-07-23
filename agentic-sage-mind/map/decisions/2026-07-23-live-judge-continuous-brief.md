---
type: decision
summary: "Optional live judge agent sessions write store-native continuous briefs; SAGE core stays passive CLI with layered attach and collision exclusion for role=judge."
status: accepted
created: 2026-07-23
updated: 2026-07-23
related:
  - "[[judge-surface]]"
  - "[[skills-templates]]"
  - "[[session-store]]"
sources:
  - "[[2026-07-23-live-judge-session-design]]"
---

# Live judge = continuous brief, not core LLM

## Context

SAGE is a deterministic fleet sensor. Humans use `sage war`; workers consult CLI facts. Users wanted an optional **special agent session** that watches live and reasons so consult answers can include narrative analysis — without turning the core into an orchestrator or LLM service.

## Decision

1. **Fallback A:** workers always get CLI facts; briefs only append when fresh.
2. **Continuous brief:** judge session polls and publishes on its own (no per-ask RPC).
3. **Store-native files:** `briefs/fleet.json` + `repos/<id>/brief.json`.
4. **Flexible scope:** 0–N repo judges + optional fleet; layered attach repo → fleet.
5. **Explicit `sage judge on/off` + `sage-judge` skill**; `sage judge publish` is pure write.
6. **`role: judge` excluded** from territory / merge-brief / HEAT peers; still visible on board/war.
7. **Grace window (30s default):** after judge process dies, last active brief still attaches so burst publish / crash does not instantly go silent; clean `judge off` marks stale immediately. Slot exclusivity still requires a live judge.

## Consequences

- Zero LLM in Node; zero new runtime deps.
- Fail-open: stale/missing brief → pure CLI; grace is bounded.
- One writer per brief slot (`--takeover` only when another live judge holds it).
- Skills install picks up `sage-judge` via existing `skills/*` symlink.
- Shipped as **1.2.0**.
