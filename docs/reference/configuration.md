---
title: "Configuration"
description: "Scope, storage layout, and env knobs for agentic-sage."
section: reference
order: 20
---

# Configuration

SAGE keeps configuration intentionally small. Prefer defaults; layer project choices only when you need them.

## Scope

| Mode | Meaning |
|------|---------|
| **Global** | `sage on` — home layout; multi-repo war board |
| **Project** | `sage enable` inside a git repo — judge that project’s sessions |

## Storage

Session / board state lives under SAGE’s store (home-relative by default). Controllers that want custom paths should read the example contract:

→ [`CONVENTIONS.md`](../../CONVENTIONS.md) (example, not required)

Do not point the store at random product directories unless you understand backup and multi-machine implications.

## Env

Common overrides (see `sage doctor` and SETUP for current names):

- Scope / home overrides used by install and hooks
- Statusline / adapter discovery paths

Treat `SETUP.md` § Optional and Recommended as the human checklist; this page is the index.

## Adapters

Optional project enrichment without forking core:

→ [Adapters](./adapters.md) · [`ADAPTERS.md`](../../ADAPTERS.md)

## Full human checklist

→ [`SETUP.md`](../../SETUP.md) (required / recommended / optional / dogfood)
