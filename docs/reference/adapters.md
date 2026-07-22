---
title: "Adapters"
description: "Optional SAGE project adapters — discovery, contract, fail-closed-to-core."
section: reference
order: 30
---

# Adapters

Adapters **enrich** SAGE for a project (globs, labels, handoff blobs). They never become a hard dependency for core judging.

## Rules of the road

1. **Discovery order** is documented in [`ADAPTERS.md`](../../ADAPTERS.md).
2. **Fail-closed-to-core** — a broken adapter must not take down board/war/doctor.
3. **Optional** — zero adapters is a valid fleet.

## Contract (summary)

Adapters export a small surface (project blob, globs dialect, optional hooks). Full contract + worked `acme` example:

→ **[`ADAPTERS.md`](../../ADAPTERS.md)**  
→ Code: `adapters/acme.mjs`, `adapters/template.mjs`

## When to write one

- You have a custom monorepo layout and want cleaner territory globs
- You want board labels that match your internal product names
- You integrate with a sibling tool and need a stable handoff shape

When *not* to: everyday Claude/Grok fleets on normal repos — core is enough.
