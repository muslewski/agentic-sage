# agentic-sage — overview

**SAGE** (Session Awareness & Guidance Engine) is a passive, read-only **fleet judge** for parallel AI coding sessions (Claude Code, Grok Build CLI, and compat harnesses). One judge per repo: it records self-declared session truth via a fail-open, default-OFF lifecycle emitter, then answers *who is doing what* and *am I about to collide* through CLI verbs (`board`, `territory`, `war`, …). Zero runtime dependencies, Node ≥ 20. Universal core works with no project config; optional adapters name zones/backlog rows.

## Seeded zones (2026-07-21 atlas-seed)

| Slug | Purpose |
|------|---------|
| [[cli]] | `bin/sage` command dispatch |
| [[emitter]] | Lifecycle hook + throttle/stdin helpers |
| [[session-store]] | Records, storage roots, identity, liveness, handoff, prune |
| [[judge-surface]] | Board/fleet/territory/git/guard/doctor read surface |
| [[war-room]] | Full-screen multi-repo TUI cockpit |
| [[install-wiring]] | init/install/uninstall/settings merge |
| [[adapters]] | Optional per-repo adapter contract + examples |
| [[skills-templates]] | sage-fleet / sage-doctor skills + paste snippets |

All cards: `status: seeded`, `verifiedAt: unverified` until a human review stamps them.

## Out of zone (for now)

Tests (`test/**`), demo tapes, marketing assets, CI workflows, advisor-plans, and long-form docs — not partitioned on this seed pass. SCHEMA.md describes machine-readable envelopes produced by the judge-surface + CLI.
