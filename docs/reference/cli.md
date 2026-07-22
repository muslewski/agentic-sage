---
title: "CLI reference"
description: "agentic-sage sage command verbs — board, war, doctor, init, on/off, enable."
section: reference
order: 10
---

# CLI reference

Binary names: **`sage`** · **`agentic-sage`** (same entry).

Run `sage --help` / `sage <verb> --help` for the live surface. Below is the product map.

## Everyday

| Command | Purpose |
|---------|---------|
| `sage board` | Per-repo session board (must be inside a judged git repo) |
| `sage war` | Cross-repo war-room cockpit (TTY interactive) |
| `sage doctor` | Health checks + fix hints |
| `sage status` | Compact status / wiring summary |

## Install & lifecycle

| Command | Purpose |
|---------|---------|
| `sage init` | Bootstrap hooks/templates for this machine |
| `sage on` / `sage off` | Global judging switch |
| `sage enable` / `sage disable` | Project-scoped judging |
| `sage uninstall` | Surgical remove (see `uninstall/README.md`) |

## Coordination (optional)

| Command | Purpose |
|---------|---------|
| `sage guard` | Guard / claim-related checks (see help) |
| `sage backlog` | Backlog coordination helpers when enabled |
| `sage link` / `sage unlink` | Wiring helpers |

## Statusline

| Command | Purpose |
|---------|---------|
| `sage statusline` | Emit / install statusline segment (Claude / tmux consumers) |

## Safety

SAGE is **passive**. CLI verbs that *look* active (init, enable, statusline install) only touch **SAGE’s own wiring and store**, not your application source as an agent would.

Full narrative: [README — Safety](../../README.md#safety) · [SETUP.md](../../SETUP.md)

## Machine JSON

Board / fleet machine envelopes: [`SCHEMA.md`](../../SCHEMA.md)
