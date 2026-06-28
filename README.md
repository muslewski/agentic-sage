# SAGE — the Old Wise One

**S**ession **A**wareness & **G**uidance **E**ngine: a passive, read-only **fleet judge** for
running many parallel agent coding sessions (e.g. Claude Code). It does no work, spawns nothing,
edits nothing. It watches every session, holds each one's self-declared truth (time-aware), and
answers two questions cheaply:

1. **Who is doing what — and how stale is that knowledge?**
2. **Why did these branches diverge / am I about to collide with another session?**

Project-agnostic: a small **core** runs on universal signals (git, the session registry, a generic
handoff sidecar); optional per-project **adapters** add richer awareness. **One judge per repo.**

> Status: pre-alpha. **P1 — core storage + emit** (this commit range). Design + phased program live in
> the syndcast Mind (`syndcast-mind/specs/2026-06-28-sage-fleet-judge-design.md`,
> `…/programs/2026-06-28-sage-fleet-judge-program.md`).

## Safety

The emitter (`hooks/sage-emit.mjs`) fires on **every** session. It is **fail-open** (any error → exit 0,
never blocks a hook) and **default-OFF** (no `~/.claude/sage/config.json` ⇒ disabled). `install.mjs`
never auto-enables and never clobbers existing `settings.json` hooks.

## Develop

```bash
node --test        # all unit + integration tests
node install.mjs   # wire into ~/.claude (installs DISABLED — you opt in)
```
