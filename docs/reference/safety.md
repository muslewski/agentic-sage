---
title: "Safety"
description: "Default-OFF, fail-open emitter, optional guard, and what SAGE never does."
section: reference
order: 40
---

# Safety

SAGE is built to be invisible when you do not want it and non-blocking when something goes wrong.

## Default OFF

Judging does not start until you opt in:

- Global install: `sage on` (master switch in `~/.claude/agentic-sage/config.json`)
- Project install: `sage enable` in that repo

Install alone leaves the machine unjudged.

## Fail-open emitter

The lifecycle hook (`hooks/agentic-sage-emit.mjs`) runs on many session events. Any error exits 0 and allows the action. A broken SAGE never blocks an agent tool call.

While OFF, the emitter is a first-line no-op.

## What it does not do

- Does not edit your product tree as “help”
- Does not spawn agent sessions
- Does not merge branches or open PRs
- Does not lock files — claims are advisory unless you arm the guard

## The guard (optional, default OFF)

`sage guard` can block edits to contested paths (`PreToolUse` → exit 2). Two switches must both be on:

1. Judging enabled for the install (`sage on` / `sage enable`)
2. `sage guard on` for the repo

Invariants: fail-open on error, default-off, cheap no-op when no guard is armed.

Do not arm the guard unless you explicitly want hard blocks.

## What `sage init` wires

It merges lifecycle hooks into the target settings file (backup once, skip-if-present, abort on malformed JSON) and links skills. It does **not** auto-enable unless you pass `--enable`.

| Hook event | Effect |
|------------|--------|
| `SessionStart` | Record/refresh session; optional soft fleet line |
| `UserPromptSubmit` | Refresh liveness |
| `PostToolUse` | Throttled liveness refresh |
| `Stop` | Last-turn-fresh record |
| `PreCompact` | Lightweight handoff sidecar |
| `SessionEnd` | Mark closed |
| `PreToolUse` | Guard only (inert unless armed) |

Undo: `node uninstall/uninstall.mjs` (surgical; keeps state for manual delete).

## Related

- [Configuration](./configuration.md)
- [CLI reference](./cli.md)
- Human checklist: [`SETUP.md`](../../SETUP.md)
