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

1. Sessions stamp liveness and optional claims / territory.
2. You (or a skill) call `board` / `war` / `merge-brief`.
3. You reallocate work; SAGE does not reallocate for you.

Agent session protocol: skill `skills/sage-fleet/SKILL.md` after install.

## Two-layer communication (convention)

| Layer | Role | Operator action |
|-------|------|-----------------|
| **Sensor / CLI** | Deterministic cross-session facts | Install + `sage on` — workers call CLI/skills |
| **Live judge** | Passive agent pane that *reasons* and publishes briefs | `sage judge run` (or `judge on` + skill loop) |

**Easy path:** after install, sessions already get cross-session context through the CLI. When you run **`sage judge run`**, the same verbs workers already use gain a **living** judge — more precise narrative and per-audience advice, without a second API. Facts stay authoritative; briefs are additive when fresh.

This is how SAGE moves from “CLI for awareness” to a **session-communication system**: shared store + opt-in watcher that speaks the same language as every worker.

## Optional live judge pane

A dedicated Claude/Grok session can run `sage judge run` / `sage judge on` and publish continuous
**briefs** (narrative only). Workers still trust CLI contested/clear as authority;
briefs layer after facts when fresh (including a short post-exit grace window).
See recipe [Live judge](../recipes/live-judge.md) and skill `sage-judge`.

## Related

- [Getting started](../getting-started.md)
- [Claims and territory](./claims-and-territory.md)
- [Safety](../reference/safety.md)
- Architecture map (agents): [`agentic-sage-mind/map/index.md`](../../agentic-sage-mind/map/index.md)
