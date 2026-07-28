---
type: spec
summary: "Fleet-follow agentic-sage: config judge.desired preferred|optional with soft-only offline warns; install freshness gate; local telemetry; thin atlas interop — CLI-only remains first-class."
tags: [fleet, live-judge, gate, telemetry, memory-atlas, preferred]
status: approved
created: 2026-07-28
updated: 2026-07-28
origin: brainstorming-session-after-memory-atlas-handoff
related:
  - "[[2026-07-23-live-judge-session-design]]"
  - "[[2026-07-23-judge-run-and-war-chrome-design]]"
sources:
  - "docs/concepts/fleet-judge.md"
  - "map/decisions/2026-07-23-live-judge-continuous-brief.md"
---

# Fleet-follow preferred judge + control plane

**Status:** approved 2026-07-28  
**Goal:** Make “this desk wants a living judge” a **config preference**, not a product requirement. Manjaro (and any fleet that opts in) gets soft warnings when preferred judge is offline — same *feel* as memory-atlas package freshness — without blocking coding. Keep agentic-sage and memory-atlas independent products that optionally improve each other.

## Problem

1. Live judge (layer 2) is powerful but **optional by design**. Many users want CLI-only (layer 1). Manjaro wants preferred live judge + soft remind when it dies.
2. No `sage gate`, no install/wire freshness, no local telemetry — unlike memory-atlas fleet control plane.
3. Atlas ↔ sage interop is one-way and underused (example adapter exists; almost no product repo has it).
4. Global CLI model must not copy atlas’s “34 per-repo package pins.”

## Decisions locked

| # | Decision |
|---|----------|
| 1 | Product default: `judge.desired = "optional"` — no offline-judge noise |
| 2 | Fleet opt-in: `judge.desired = "preferred"` — soft warn only when unsatisfied |
| 3 | Soft surfaces only: SessionStart one-liner + `sage doctor` + `sage gate` (default exit 0) |
| 4 | Preferred-offline is **never** a hard fail — even under `sage gate --strict` |
| 5 | `--strict` may fail on **install/wiring/freshness** only |
| 6 | No PreToolUse / UserPrompt inject for preferred-offline in v1 |
| 7 | No auto-spawn LLM on SessionStart; no LLM in Node core |
| 8 | Install model stays **global bin**; state under sage home |
| 9 | Telemetry: local JSONL, default OFF, fleet ON once; no network v1 |
| 10 | Atlas interop: file-only, fail-open if sibling missing; no shared runtime |

## Config

**Path:** `~/.claude/agentic-sage/config.json` (existing global config; merge keys)

```json
{
  "enabled": true,
  "judge": {
    "desired": "optional",
    "scope": "auto",
    "harness": "auto",
    "warnIfOffline": true,
    "commands": { "grok": "grok", "claude": "claude" }
  },
  "packageFreshness": {
    "mode": "warn",
    "registry": true,
    "wired": true,
    "registryTtlHours": 24
  }
}
```

| Field | Default | Meaning |
|-------|---------|---------|
| `judge.desired` | `"optional"` | `"optional"` \| `"preferred"` |
| `judge.warnIfOffline` | effective true when preferred | If false, preferred still records desire but skips warn surfaces |
| `judge.scope` / `harness` | existing `auto` | Unchanged launcher prefs |

**v1:** global only (no per-repo desired override).

### Satisfied probe

`isJudgeDesireSatisfied(home, { now })` is true when **any** of:

- A live session with `role === "judge"` (fleet or any repo), **or**
- An **attachable** fleet brief, **or** (if cwd resolves a repo) attachable repo brief  

Freshness = existing `isBriefFresh` (TTL + live pid **or** grace).

When `desired !== "preferred"` or `warnIfOffline === false` → probe unused for warns.

## Soft warn surfaces

| Surface | Message (example) | Exit |
|---------|-------------------|------|
| SessionStart | `sage: live judge preferred · offline — run: sage judge run` | always 0 |
| `sage doctor` | live judge row: ok when satisfied or optional; soft-ok with detail when preferred+offline (still `ok: true` so health % not punished) **or** `ok: true` + detail line — prefer **always ok:true** with clear detail so doctor stays “install health,” not policy fail | always 0 |
| `sage gate` | print preferred-offline finding among others | always 0 (default) |

Doctor row detail examples:

- optional: `optional — CLI facts work without it`
- preferred + satisfied: `preferred · satisfied (live / brief fresh)`
- preferred + offline: `preferred · offline — run: sage judge run`

## Install freshness + `sage gate`

**State file:** `~/.claude/agentic-sage/state.json` (new)

```json
{
  "wiredVersion": "1.2.0",
  "wiredAt": "ISO-8601",
  "updateCheck": { "checkedAt": "ISO-8601", "latest": "1.2.1", "source": "npm" }
}
```

| Tier | Compare | Message |
|------|---------|---------|
| A wired | `packageVersion()` vs `state.wiredVersion` | re-run `sage init --repair` / wire |
| B registry | installed vs `npm view agentic-sage version` (TTL cache, fail-open) | `npm i -g agentic-sage@…` then re-wire |

Stamp `wiredVersion` on successful `wireAll` / `wireProject` / `sage init` apply paths.

```
sage gate              # soft findings; exit 0 always for preferred-offline
sage gate --strict     # exit 1 only if wiring broken or packageFreshness.mode=fail lags
```

No repo / SAGE off → gate soft exit 0 (strict may still report missing sage home if useful — prefer soft for missing git).

## Telemetry (local debug)

Mirror memory-atlas local-debug pattern:

| Rule | Value |
|------|--------|
| Default | OFF |
| Enable | `SAGE_TELEMETRY=1`, `~/.config/agentic-sage/config.json` `telemetry.enabled`, or `sage telemetry on` (writes global machine config) |
| Store | `~/.cache/agentic-sage/events.jsonl` + `install-id` |
| Network | none |
| Skip | SessionStart inject path, `telemetry *` subcommands |
| Fields | `v, ts, cmd, argv_shape, exit, ms, sage_version, install_id, node, os, repo_id` (path hash), optional `judge_desired`, `judge_satisfied` (bool only) |
| Forbidden | brief text, free-text paths, prompts, vault content |

CLI: `sage telemetry status|report|dump|clear|on|off`

## Always-on judge (ops, not hard dep)

When preferred:

1. Doctor/gate fix line: `sage judge run` (or `--harness none` for fact keeper)
2. Docs/recipe: manjaro keeps one tmux pane for judge; optional later systemd for fact-keeper only
3. **Out of v1:** auto background spawn without explicit human action

## Thin atlas ↔ sage interop

| Edge | Work |
|------|------|
| Sage → Atlas | Fleet script drops `memory-atlas/examples/with-agentic-sage/adapter.mjs` → `.agentic-sage/adapter.mjs` when `atlas.config.json` present |
| Sage doctor | If `atlas.config.json` in cwd main root and no adapter → soft detail on project adapter row |
| Atlas doctor/status | If `sage` on PATH and vault present without `.agentic-sage/adapter.mjs` → soft optional line; silence if sage missing |
| SessionStart | Both tools soft lines coexist; never block |

No vault writes from sage. No shared process.

## Fleet scripts (sage repo)

| Script | Role |
|--------|------|
| `scripts/fleet-wire-preferred-judge.mjs` | Set global `judge.desired=preferred`, optional telemetry on |
| `scripts/fleet-drop-atlas-adapter.mjs` | Sibling repos with atlas.config: ensure adapter file |

Reports: `agentic-sage-mind/reports/`

## Architecture

```
config.judge.desired
        │
        ├─ SessionStart ── soft preferred-offline (if enabled + preferred + unsatisfied)
        ├─ doctor / gate ── same probe + install freshness
        └─ sage judge run ── publish briefs ── workers pull on consult

state.json ── wiredVersion / updateCheck
telemetry ── ~/.cache/agentic-sage/events.jsonl (opt-in)

atlas (peer) ── optional adapter + soft sibling lines
```

## Non-goals

- `desired: "required"` hard mode  
- Mid-flight push inject  
- Auto LLM judge on SessionStart  
- Per-repo package.json pin of agentic-sage for all siblings  
- Brief-driven guard  
- Remote telemetry sink  

## Success criteria

1. Default optional → no preferred-offline spam  
2. preferred + offline → SessionStart + gate + doctor detail; exit 0  
3. preferred + satisfied → silence  
4. `gate --strict` fails only on install/freshness when mode=fail / broken wire — never preferred-offline  
5. Telemetry default off; fleet can enable  
6. Adapter drop script works on at least one vault repo  

## Implementation slices

| Slice | Deliverable |
|-------|-------------|
| S1 | `judge.desired` + probe + doctor + SessionStart soft |
| S2 | `state.json` stamp + package freshness + `sage gate` |
| S3 | Local telemetry + CLI |
| S4 | Fleet scripts + manjaro preferred helper |
| S5 | Atlas soft sibling line (memory-atlas, small) |

## Open questions

None for v1 — deferred: per-repo desired override; `sage judge ensure`; systemd fact-keeper unit.
