---
type: spec
summary: "sage judge run (configurable harness spawn + none keeper) and war chrome for live/grace judge visibility; auto fleet-vs-repo scope."
tags: [live-judge, war-room, launch]
status: approved
created: 2026-07-23
updated: 2026-07-23
related: []
sources: []
---

# Judge run + war chrome — Design

**Status:** approved 2026-07-23  
**Depends on:** live judge continuous briefs (1.2.0)

## Goals

1. One-command start: `sage judge run` with harness auto (grok → claude → suggest none).
2. Scope auto: fleet if multi-repo desk, else this repo.
3. War shows judge online (live or grace).
4. No per-repo setup; global install covers all repos.

## CLI

```
sage judge run [--auto|--fleet|--repo] [--harness auto|grok|claude|none]
               [--once] [--takeover] [--print-only]
```

Config `judge` block in global config (additive).

## War

Header chip `⚖ …`; FLEET panel line when judges/briefs active; JSON totals + brief summary.

## Non-goals

LLM in core; auto-start on every SessionStart; spawning coding workers.
