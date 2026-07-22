---
title: "Fleet judge"
description: "SAGE keeps the human at fleet altitude — read-only, default-OFF, advisory."
section: concepts
order: 10
---

# Fleet judge

SAGE is not an orchestrator. It does **not** spawn agents, rewrite trees, or own merges. It is a **judge** for fleets of parallel coding sessions.

## Keep the human at fleet altitude

When five Claude/Grok sessions run on one desk, the scarce resource is **your** attention. SAGE answers:

- Who is live, idle, or stuck?
- Who claims which territory (globs / paths)?
- What should I know before merge?

So you stay above the battlefield instead of living inside one pane.

## Read-only, fail-open

- No writes to your product trees as “help.”
- Missing sessions, empty stores, half-wired hooks → degrade and tell you; never hard-block a tool.

## Default OFF

Judging is opt-in (`sage on` / `sage enable`). A fresh install leaves the fleet unjudged until you say so. That is intentional trust design — not a missing feature.

## Universal core vs project

| Layer | What |
|-------|------|
| **Universal core** | Board, war, doctor, session store, hooks, statusline — same on every machine |
| **Project layer** | Optional adapters, project-scoped enable, backlog conventions you choose |

See README § “Universal core vs your project” and [`CONVENTIONS.md`](../../CONVENTIONS.md) for an *example* controller contract (not law).

## Flywheel

1. Sessions stamp liveness and optional territory.
2. You (or a skill) call `board` / `war` / merge brief.
3. You reallocate work; SAGE does not reallocate for you.

Agent session protocol: skill `skills/sage-fleet/SKILL.md` after install.

## Related

- [Getting started](../getting-started.md)
- [Safety notes](../reference/cli.md#safety)
- Architecture map (agents): [`agentic-sage-mind/map/index.md`](../../agentic-sage-mind/map/index.md)
