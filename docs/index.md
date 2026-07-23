---
title: "Documentation"
description: "Fleet judge for parallel AI coding sessions — install, concepts, CLI, and recipes."
section: home
order: 0
---

# agentic-sage documentation

**SAGE** is a passive, read-only **fleet judge** for parallel AI coding sessions (Claude Code, Grok Build, and friends). It watches and answers. It never edits, spawns, or blocks.

Site: [sage.muslewski.com](https://sage.muslewski.com) · npm: [`agentic-sage`](https://www.npmjs.com/package/agentic-sage)

## Start here

| Path | For |
|------|-----|
| [Getting started](./getting-started.md) | Install → `sage init` → `sage on` → `sage doctor` |
| [Concepts: fleet judge](./concepts/fleet-judge.md) | Why SAGE exists; default-OFF; human at fleet altitude |
| [CLI reference](./reference/cli.md) | Verbs and flags |
| [Configuration](./reference/configuration.md) | Scope, storage, env |
| [Adapters](./reference/adapters.md) | Optional project enrichment |
| [Recipes](./recipes/index.md) | Multi-harness, dogfood, statusline |
| [Works with](./works-with.md) | Fleet siblings (herald, oracle, atlas, armory, ferry) |

## Doctrine (short)

1. **Keep the human at fleet altitude** — not a queen-agent orchestrator.
2. **Read-only / fail-open** — missing data never blocks work.
3. **Default OFF** — you opt sessions in; install does not hijack the machine.
4. **Advisory, not arbitrating** — territory and merge briefs inform; they do not merge for you.

## Where other knowledge lives

| Kind | Location |
|------|----------|
| **Public product docs** | `docs/` (this tree) |
| **Architecture mind (Atlas)** | [`agentic-sage-mind/`](../agentic-sage-mind/) — zones, decisions, **specs**, **plans** |
| **Agent install runbook** | [`AGENTS.md`](../AGENTS.md) |
| **Human setup deep-dive** | [`SETUP.md`](../SETUP.md) |
| **Changelog** | [`CHANGELOG.md`](../CHANGELOG.md) |

Specs and implementation plans used to live under `docs/superpowers/`. They now live in the mind vault (Syndcast-style): see [SUPERPOWERS-MOVED.md](./SUPERPOWERS-MOVED.md).
