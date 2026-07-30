---
title: "Getting started"
description: "Install agentic-sage, turn judging on, register a session, and verify with sage doctor."
section: guide
order: 10
---

# Getting started

Install the CLI, turn judging on, then run the same happy path the README uses:
register → claim → board → territory / merge-brief.

## 1. Install

```bash
npm install -g agentic-sage
```

Requires **Node ≥ 20**. Bins: `sage` and `agentic-sage`.

Other channels (plugins, skills.sh, clone-from-source): [Distribution](./distribution.md).

## 2. Init (wires hooks / skills; default OFF)

```bash
sage init
```

Interactive wizard on a TTY; non-interactive defaults to global scope + storage +
**disabled**. Flags: `sage init --global` / `--project` / `--repair` / `--show`
— see [`AGENTS.md`](../AGENTS.md).

## 3. Turn judging on

```bash
# global (default home layout)
sage on

# or only for the current git project
cd /path/to/repo && sage enable
```

SAGE is **default OFF** until you opt in. Install alone does not start judging
every session.

## 4. Doctor

```bash
sage doctor
```

Fix anything red. When doctor is green:

```bash
sage board          # inside a repo
sage war            # fleet cockpit across repos (TTY)
```

## 5. First coordination loop

```bash
sage register --sid my-worker --pid $$ --lane feature --by me --kind worker
SAGE_SELF_SID=my-worker sage claim 'src/**'
sage board
SAGE_SELF_SID=my-worker sage territory 'src/**'
SAGE_SELF_SID=my-worker sage merge-brief
```

On macOS (no `/proc`), set `SAGE_SELF_SID` explicitly for `claim` — pid-walk
cannot find your record.

## Agent path

If an agent is installing for you, follow the machine-oriented runbook:

→ **[`AGENTS.md`](../AGENTS.md)** (install → enable → wire snippet → optional adapter → doctor)

## Next

- [Claims and territory](./concepts/claims-and-territory.md)
- [Concepts: fleet judge](./concepts/fleet-judge.md)
- [CLI reference](./reference/cli.md)
- [Safety](./reference/safety.md)
- [Multi-harness recipe](./recipes/multi-harness.md)
