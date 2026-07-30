---
title: "Configuration"
description: "Scope, storage layout, judge preference, and env knobs for agentic-sage."
section: reference
order: 20
---

# Configuration

SAGE keeps configuration intentionally small. Prefer defaults; layer project
choices only when you need them.

## Scope vs storage (two axes)

`sage init` sets **where the hook is wired** (scope) and **where data lives**
(storage) independently.

| | Global scope (default) | Project scope (`sage init --project`) |
|---|---|---|
| Hook wired into | `~/.claude/settings.json` (Grok reads via compat by default) | `<repo>/.claude/settings.json` |
| Storage default | `~/.claude/agentic-sage` | `<repo>/.agentic-sage` (or `--storage sibling\|agent-home`) |
| Master switch | `sage on` / `sage off` | ignored — project install works even with global master OFF |
| Per-repo switch | `sage enable` / `sage disable` | `sage enable` / `sage disable` (only switch in this scope) |

Inspect resolution any time:

```bash
sage where          # this repo
sage init --show    # full breakdown
```

Storage precedence (env → in-repo marker → registry → global default → built-in
→ legacy fallback) is documented in [`CONVENTIONS.md`](../../CONVENTIONS.md).
Power-user override: env `SAGE_STORAGE_ROOT` (a root directory, not a single repo).

## Global config shape

Typical `~/.claude/agentic-sage/config.json`:

```json
{
  "enabled": true,
  "judge": {
    "desired": "optional",
    "warnIfOffline": true,
    "scope": "auto",
    "harness": "auto"
  }
}
```

| Field | Default | Meaning |
|-------|---------|---------|
| `enabled` | absent/false → OFF | Global master for judging |
| `judge.desired` | `optional` | `preferred` enables soft offline warnings |
| `judge.warnIfOffline` | `true` when preferred | SessionStart / `sage gate` / doctor soft line |
| `judge.scope` / `harness` | `auto` | Used by `sage judge run` |

When preferred and offline:

```text
sage: live judge preferred · offline — run: sage judge run
```

Exit code stays 0. `sage gate --strict` fails only on install/freshness lag,
never on preferred-offline.

## Env

| Variable | Role |
|----------|------|
| `SAGE_SELF_SID` | Force “this session” for claim / consult (needed on macOS without `/proc`) |
| `SAGE_OPT_OUT=1` | Per-process opt-out of judging |
| `SAGE_STORAGE_ROOT` | Override storage root |
| `FLEET_DEVLOG` | Opt-in local developer log — [Developer logging](./developer-logging.md) |

A `.sage-ignore` file in cwd also opts that tree out.

## Adapters

Optional project enrichment without forking core:

→ [Adapters](./adapters.md) · [`ADAPTERS.md`](../../ADAPTERS.md)

## Full human checklist

→ [`SETUP.md`](../../SETUP.md) (required / recommended / optional / dogfood)
