---
title: "CLI reference"
description: "agentic-sage sage command verbs — board, register, claim, territory, merge-brief, judge, doctor."
section: reference
order: 10
---

# CLI reference

Binary names: **`sage`** · **`agentic-sage`** (same entry).

Run `sage` with no args (or an unknown verb) for the live usage list. Below is
the product map. Prefer the live binary over this page when they disagree.

## Everyday

| Command | Purpose |
|---------|---------|
| `sage board [--watch] [--wide\|-w] [--all] [--flat] [--json]` | Per-repo session roster |
| `sage war [--json] [--wide\|-w] [--all]` | Cross-repo war-room cockpit (TTY interactive) |
| `sage fleet [--json]` | One-line nearest-neighbour summary |
| `sage doctor` | Health checks + fix hints |
| `sage gate [--strict]` | Soft install freshness + preferred-judge offline warn |
| `sage where` | This repo’s resolved scope + storage + matched rule |

## Register, claim, collision

| Command | Purpose |
|---------|---------|
| `sage register --sid <id> [--pid <n>] [--cwd <path>] [--parent <sid>] [--kind …] [--lane …] [--fleet-run …] [--corr …] [--by …] [--json]` | Launcher-side session declaration (contract C4) |
| `sage register heartbeat --sid <id> […]` | Refresh liveness stamp |
| `sage register close --sid <id> [--result ok\|failed\|partial]` | Mark closed |
| `sage claim <glob…>` | Write `claimed_globs` on **this** session (needs self) |
| `sage territory <glob…>` | Who else claims/touches these paths |
| `sage why-diverged <file>` | Which sessions touch a file + optional numstat |
| `sage merge-brief` | Paths contested by two or more *other* live sessions |

Self resolution for `claim` / consult verbs: pid-walk to an open record, or set
`SAGE_SELF_SID`. Claim refuses closed sessions, judge-role sessions, and unsafe
ids. Usage when no globs: `usage: sage claim <glob> [glob…]` (exit 2). There is
no `claim --help` — `--help` is claimed as a literal glob.

Claims vs touches: [Claims and territory](../concepts/claims-and-territory.md).

## Install and lifecycle

| Command | Purpose |
|---------|---------|
| `sage init` | Wizard or `--global` / `--project` / `--repair` / `--show` |
| `sage on` / `sage off` | Global judging switch |
| `sage enable` / `sage disable` | Project-scoped judging |
| `sage prune [--all] [--older-than <d>] [--dry-run] [--yes] [--json]` | Drop old closed sessions (also older `--days` form in help) |
| `sage link <sid> [state]` / `sage unlink <sid>` | Manual link_state helpers |

Uninstall: `node uninstall/uninstall.mjs` (see `uninstall/README.md`).

## Optional coordination

| Command | Purpose |
|---------|---------|
| `sage backlog` / `sage backlog claim <row>` | Adapter-gated backlog rows |
| `sage guard …` | `list` \| `add` \| `rm` \| `on` \| `off` (default OFF) |
| `sage adapter init` | Scaffold `.agentic-sage/adapter.mjs` |
| `sage repos [--all]` | Product/orphan atlas |
| `sage statusline` | “Asking Sage” segment (empty unless consulting) |
| `sage about --tmux <session> [--json]` | Facts + judge one-liner for a tmux session |
| `sage telemetry …` | Local debug stream (default OFF) |

## Live judge (optional)

No LLM inside Node. Optional Claude/Grok pane writes narrative briefs.

| Command | Purpose |
|---------|---------|
| `sage judge run […]` | Easy start — auto scope + harness (or fact-only) |
| `sage judge on --fleet\|--repo [--takeover]` | Mark this session as live judge |
| `sage judge off` | Clear role; mark brief stale |
| `sage judge publish` | Stdin JSON → atomic brief write |
| `sage judge status` / `show` | Freshness + print brief |

`judge run` flags: `--auto|--fleet|--repo`, `--harness auto|grok|claude|none`,
`--once`, `--takeover`, `--print-only`.

**Offline by default:** without a live judge or fresh brief, CLI answers stay
fact-only. Recipe: [Live judge](../recipes/live-judge.md).

## Safety

SAGE is **passive**. CLI verbs that look active (init, enable, statusline) only
touch **SAGE’s own wiring and store**, not your application source. Register
refuses path-shaped and other unsafe `--sid` values; board readers skip
non-files under `sessions/` so a FIFO cannot hang the roster.

→ [Safety](./safety.md) (containment, identity, reader bounds) · [`SETUP.md`](../../SETUP.md)

## Machine JSON

Board / fleet envelopes: [`SCHEMA.md`](../../SCHEMA.md)
