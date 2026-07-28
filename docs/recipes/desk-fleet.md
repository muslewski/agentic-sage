---
title: "Wire a multi-repo desk"
description: "Ten minutes: SAGE fleet judge + optional Atlas vaults across several repos."
section: recipes
order: 15
---

# Wire a multi-repo desk (≈10 minutes)

Goal: one workstation, several repos, **session present** (SAGE) everywhere you care about collision risk, and **architecture memory** (Atlas) only where you want verified zones.

This is a copy-paste path, not a product tour. Deep checklists: [`SETUP.md`](../../SETUP.md) · [memory-atlas On-ramp](https://github.com/muslewski/memory-atlas/blob/main/docs/ONRAMP.md). Story: [Works with](../works-with.md) (dual superpower).

## 0. Prerequisites

- Node ≥ 20
- One or more git repos on the machine that runs agents (not only the laptop browser)

## 1. Install once (global)

```bash
npm i -g agentic-sage memory-atlas
sage init          # wizard: global + OFF by default
sage on            # opt the machine in
sage doctor        # fix any → run: … lines
```

SAGE is **default-OFF** until `sage on`. Atlas does nothing until a repo runs `atlas init`.

## 2. Per repo — judge (always for multi-session work)

From each repo root you want on the board:

```bash
cd /path/to/repo-a
# global-scope install already watches cwd repos; project-only installs use:
#   sage init --project && sage enable
sage doctor
```

Paste the always-on pointer when you want sessions to *use* the fleet skill:

- Claude / compat: `templates/CLAUDE.snippet.md` → repo or user `CLAUDE.md`
- Grok-native: `templates/GROK.snippet.md` → `AGENTS.md`

Repeat for repo-b, repo-c, …

## 3. Per repo — vault (optional, high-value codebases)

Only where you want zone cards + `atlas check`:

```bash
cd /path/to/repo-a
atlas init
atlas wire         # SessionStart + on-ramp blocks (fail-open next to sage)
# seed/verify zone cards, then:
atlas build && atlas check
```

**Optional enrichment:** teach SAGE zone names from the vault — copy
[memory-atlas `examples/with-agentic-sage/adapter.mjs`](https://github.com/muslewski/memory-atlas/blob/main/examples/with-agentic-sage/adapter.mjs)
to `.agentic-sage/adapter.mjs` (or `sage adapter init` then replace). Coupling stays file-only; a missing vault degrades to path-only territory.

## 4. Desk glance

```bash
sage war           # all live sessions across the desk
sage board         # when cwd is a judged repo
sage territory 'src/**'
atlas status       # in a vault repo — SessionStart-safe summary
```

Optional live narrative judge (second layer): `sage judge run` — see [Live judge](./live-judge.md).

## 5. Done checklist

| Check | Command / signal |
|-------|------------------|
| Machine opted in | `sage doctor` clean (or only expected skips) |
| Sessions visible | `sage war` shows harness panes after work starts |
| Vault honest | `atlas check` green in adopted repos |
| Hooks coexist | both SessionStart entries present; neither blocks if the other is off |

## Related

- [Works with](../works-with.md) — dual superpower (Atlas past/map · SAGE session present)
- [Multi-harness](./multi-harness.md) — Claude + Grok under one judge
- [Dogfood layout](./dogfood.md) — how maintainers run this day to day
- [SETUP.md](../../SETUP.md) — full SAGE bootstrap
