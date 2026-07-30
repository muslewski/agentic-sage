---
title: "Documentation"
description: "Fleet judge for parallel AI coding sessions — install, concepts, CLI, and recipes."
section: home
order: 0
---

# agentic-sage documentation

**SAGE** is a passive, read-only **fleet judge** for parallel AI coding sessions
(Claude Code, Grok Build, and friends). Sessions register, claim file globs, and
ask whether merging is safe. It never edits, spawns, or blocks (unless you arm
the optional guard).

Site: [sage.muslewski.com](https://sage.muslewski.com) · npm: [`agentic-sage`](https://www.npmjs.com/package/agentic-sage)

## Start here

| Path | For |
|------|-----|
| [Getting started](./getting-started.md) | Install → `sage init` → `sage on` → `sage doctor` |
| [Claims and territory](./concepts/claims-and-territory.md) | Touched vs claimed; territory vs merge-brief |
| [Concepts: fleet judge](./concepts/fleet-judge.md) | Why SAGE exists; default-OFF; human at fleet altitude |
| [CLI reference](./reference/cli.md) | Every verb by task — flags, exits, examples |
| [Configuration](./reference/configuration.md) | Scope, storage, judge preference |
| [Safety](./reference/safety.md) | Containment, identity, fail-open, guard |
| [Developer logging](./reference/developer-logging.md) | Opt-in local fleet-devlog |
| [Adapters](./reference/adapters.md) | Optional project enrichment |
| [Troubleshooting](./reference/troubleshooting.md) | Symptoms, `sage doctor`, nvm harness note |
| [Recipes](./recipes/index.md) | Multi-harness, dogfood verdicts, statusline, live judge |
| [Works with](./works-with.md) | Fleet siblings (herald, oracle, atlas, armory, ferry) |

## Doctrine (short)

1. **Keep the human at fleet altitude** — not a queen-agent orchestrator.
2. **Read-only / fail-open** — missing data never blocks work.
3. **Default OFF** — you opt sessions in; install does not hijack the machine.
4. **Advisory, not arbitrating** — territory and merge briefs inform; they do not merge for you.
5. **Offline judge by default** — CLI facts work without a live judge pane.

## Where other knowledge lives

| Kind | Location |
|------|----------|
| **Public product docs** | `docs/` (this tree) |
| **Architecture mind (Atlas)** | [`agentic-sage-mind/`](../agentic-sage-mind/) — zones, decisions, **specs**, **plans** |
| **Agent install runbook** | [`AGENTS.md`](../AGENTS.md) |
| **Human setup deep-dive** | [`SETUP.md`](../SETUP.md) |
| **On-ramp (problem first)** | [`README.md`](../README.md) |
| **Changelog** | [`CHANGELOG.md`](../CHANGELOG.md) |

Specs and implementation plans used to live under `docs/superpowers/`. They now live in the mind vault (Syndcast-style): see [SUPERPOWERS-MOVED.md](./SUPERPOWERS-MOVED.md).
