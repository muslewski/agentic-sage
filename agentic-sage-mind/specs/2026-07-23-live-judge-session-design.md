---
type: spec
summary: "Optional live judge agent session writes continuous fleet/repo briefs; SAGE stays passive CLI sensor with layered attach on consult."
tags: [live-judge, brief, fleet, advisory]
status: approved
created: 2026-07-23
updated: 2026-07-23
related: []
sources: []
---

# Live Judge Session — Design

**Status:** approved 2026-07-23  
**Goal:** Let an optional Claude/Grok session act as a live fleet mind that continuously writes advisory briefs. SAGE core stays a passive, deterministic sensor. Workers always get CLI facts; when a fresh brief exists, it is layered on.

## Decisions locked

| # | Decision |
|---|----------|
| 1 | Offline → pure CLI (fallback A) |
| 2 | Continuous brief (judge reasons alone; no per-ask RPC) |
| 3 | Flexible scope: 0–N repo judges + optional fleet judge |
| 4 | Worker attach: layered stack (facts → repo brief → fleet brief) |
| 5 | Start/stop: explicit `sage judge` + `sage-judge` skill |
| 6 | Store-native brief files under SAGE home / repo data dir |

## Architecture

```
emitter → session store → board / territory / merge-brief / war
       │
       ├── Human: sage war
       ├── Workers: sage *  (facts always; optional brief layers)
       └── Live judge session(s) → briefs/fleet.json | repos/<id>/brief.json
```

- **No LLM inside Node.** Core only validates/writes/reads brief JSON.
- **No spawn.** Human opens a pane; skill runs the watch/reason/publish loop.
- **No blocking.** Workers never wait for a judge.
- **Collision exclusion.** Sessions with `role === "judge"` are not territory/merge-brief/why-diverged/HEAT peers. They still appear on board/war with a judge chip.

## Identity

| Field | Values |
|-------|--------|
| `role` | `"judge"` when on; cleared on off |
| `judge_scope` | `"fleet"` \| `"repo"` |
| `judge_at` | ISO-8601 when role set |

- `sage judge on --fleet` \| `--repo` (cwd resolves repo for session record).
- One writer per brief slot. Second live writer → error unless `--takeover`.
- `sage judge off` / SessionEnd clears role; brief marked `stale`.

## Brief storage

```
<sageHome>/briefs/fleet.json
<repoDataDir>/brief.json
```

Optional `.md` twins are not required for v1.

### `sage.brief` schema 1

```json
{
  "schema": 1,
  "kind": "sage.brief",
  "scope": "fleet" | "repo",
  "repo_id": null | "<id>",
  "judge_sid": "<session_id>",
  "judge_repo_id": "<id>",
  "judge_pid": 12345,
  "updated_at": "ISO-8601",
  "status": "active" | "stale",
  "ttl_ms": 120000,
  "inputs": { "live": 0, "contested": 0, "sources": ["war"] },
  "summary": "one line",
  "analysis": "short prose",
  "hotspots": [],
  "advice": [{ "audience": "all", "text": "…" }],
  "confidence": "low" | "medium" | "high"
}
```

**Fresh** when: `status === "active"` AND `now - updated_at <= ttl_ms` AND
(`role === "judge"` + live pid **OR** age ≤ grace, default 30s). Grace lets a
burst publish / crashed judge pane still attach briefly; `judge off` marks
`stale` and ends attach. Slot exclusivity for `judge on` requires a **live**
judge only. Default `ttl_ms` = 120000. Analysis soft-capped (~8 KiB).

## CLI

| Verb | Behavior |
|------|----------|
| `sage judge on --fleet\|--repo [--takeover]` | Set role on self record; slot check |
| `sage judge off` | Clear role; stale own brief(s) |
| `sage judge status` | Live judges + brief ages |
| `sage judge show [--fleet\|--repo]` | Print fresh brief text |
| `sage judge publish` | Stdin JSON → atomic brief write (no LLM) |

**Attach** (unless `--no-brief`): after fact output on `territory`, `why-diverged`, `merge-brief`, `fleet` — append layered repo then fleet sections. JSON envelopes may add `briefs: { repo, fleet }` (null when absent).

## Skills

- **`sage-judge`**: on → poll war/board → reason → publish → sleep 30–60s → off on exit. No claims, no guard arm, no product edits, no arbitration.
- **`sage-fleet`**: treat brief as advisory; CLI contested/clear remains authoritative if they disagree.

## Safety

Fail-open hooks unchanged · default-OFF · zero runtime deps · advisory ≠ arbitrate · live-only collision · judges excluded from heat · no product-tree writes.

## Out of scope (v1)

Request inbox Q&A · auto-start on `sage on` · LLM in core · guard driven by brief · kill workers · war full brief panel (chip + show is enough).
