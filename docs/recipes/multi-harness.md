---
title: "Multi-harness: Claude + Grok"
description: "Run Claude Code and Grok Build under one SAGE fleet judge."
section: recipes
order: 10
---

# Multi-harness: Claude + Grok

SAGE is harness-agnostic. The same store and board can see Claude Code and Grok Build sessions when both are wired.

## 1. Install once

```bash
npm i -g agentic-sage
sage init
sage on
sage doctor
```

## 2. Wire each harness

- **Claude Code** — paste / generate the always-on snippet (`templates/CLAUDE.snippet.md` after init; see SETUP).
- **Grok Build** — `templates/GROK.snippet.md` and Grok project rules as documented in SETUP / AGENTS.

## 3. Use one cockpit

```bash
sage war     # all live sessions
sage board   # when cwd is a judged repo
```

## 4. Skills

After install, agent skills (`sage-fleet`, `sage-doctor`) teach each session to claim territory and ask for merge briefs — without becoming a queen agent.

## Related

- [Fleet judge concept](../concepts/fleet-judge.md)
- [`AGENTS.md`](../../AGENTS.md)
