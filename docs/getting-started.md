---
title: "Getting started"
description: "Install agentic-sage, turn judging on, and verify with sage doctor."
section: guide
order: 10
---

# Getting started

Four commands. Then you have a judge, not a second agent.

## 1. Install

```bash
npm install -g agentic-sage
# or one-shot
npx agentic-sage doctor
```

Requires **Node ≥ 20**. Bins: `sage` and `agentic-sage`.

## 2. Init (wires hooks / templates on this machine)

```bash
sage init
```

This is the human-friendly bootstrap. Prefer the linear story in [`SETUP.md`](../SETUP.md) (required → recommended → optional).

## 3. Turn judging on

```bash
# global (default home layout)
sage on

# or only for the current git project
cd /path/to/repo && sage enable
```

SAGE is **default OFF** until you opt in. Install alone does not start judging every session.

## 4. Doctor

```bash
sage doctor
```

Fix anything red. When doctor is green, open a judged session (Claude Code / Grok with the wired snippet) and try:

```bash
sage board          # inside a repo
sage war            # fleet cockpit across repos (TTY)
```

## Agent path

If an agent is installing for you, follow the machine-oriented runbook:

→ **[`AGENTS.md`](../AGENTS.md)** (install → enable → wire snippet → optional adapter → doctor)

## Next

- [Concepts: fleet judge](./concepts/fleet-judge.md)
- [CLI reference](./reference/cli.md)
- [Multi-harness recipe](./recipes/multi-harness.md)
