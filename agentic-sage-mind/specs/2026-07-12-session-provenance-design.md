---
type: spec
summary: "Session Provenance + Two-Tier War Room — Design"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-12-session-provenance-design.md"
related: []
sources: []
---

# Session Provenance + Two-Tier War Room — Design

**Status:** approved 2026-07-12 · local artifact (docs/superpowers/specs is gitignored)

## Goal

`sage war` counts 349 flat `session_id`s that are actually a mix of human-managed
roots, armory-spawned executor children, `/clear` re-ids, and abandoned ghosts —
with no field to tell them apart. Give every session **provenance** (who launched
it) so the cockpit can show **human-managed roots** and fold **nested children**
into a per-repo rollup, with an honest live count.

## Context

Evidence from the live fleet (19 repos, 349 records, 2026-07-12):

- No record carries provenance. Keys are branch/head/dirty/touched/pid/liveness/
  timestamps only. `name-field:false` on every record — no human name either.
- `source` histogram: `new:153` (Grok; 85 in `.claude/worktrees/` = executor
  children), `clear:83` (all main-checkout — `/clear` mints a NEW id for the same
  human work), `startup:53`, `compact:25`, `resume:10`, `undefined:24`.
- ~78 records have no human prompt (73 also no tools) = launched/cleared then
  abandoned (ghosts).
- Claude Task-tool sub-agents do **not** create records (sidechains share the
  parent `session_id`; the emitter has no subagent case). The nested sessions the
  user sees are **armory Grok children** in worktrees.
- After the storage unify, `sage war` reports `live:164/349` — grossly inflated by
  the pid-less-defaults-alive fallback (`board.mjs:41`).

Key facts that shape the design:
- A human can legitimately start a session **inside a worktree** — so worktree
  location is NOT a reliable nested signal. The reliable signal is **parentage**:
  was this session launched by an agent, or is a human driving it via a tmux pane.
- armory is *our* launcher — it can tag its children explicitly.
- `lib/tmux.mjs` already walks the ppid chain (`ppidOf`, `paneForPid`) — the
  classification walk extends it.

## Approved decisions

- **Classification = parentage, captured at spawn, stored on the record**
  (classifies dead history too, not just live):
  - `managed_by: 'nested'` when `env.SAGE_PARENT` is set (armory child) — parent
    sid known.
  - Else walk the ppid chain: reach a tmux pane with **no agent ancestor** →
    `'human'`; an agent ancestor, or a headless chain (no pane) → `'nested'`.
- **Two-tier + rollup display.** Repo band → human-managed rows listed (labeled by
  the tmux window name, "the name you gave it"); nested children folded into
  `… +N nested agents [↵ expand]`, expandable. Dead/ghost/`/clear`-churn collapse
  so the human tier isn't 42 "main" rows. Panels headline human-managed count;
  nested + live are secondary stats.
- **Honest liveness.** pid-less → **dead**, not idle. New records always carry a
  pid (via `process.ppid`), so the historical 349 self-clean as dead and collapse
  into counts — no migration.
- **Enter:** human → tmux pane jump (captured pid); nested → cd-print (no pane).
- **Out of scope:** a full parent→child *tree* (needs per-parent linkage that is
  unreliable across detached spawns) — the rollup nests under the repo, not under a
  specific parent row. Killing/attaching nested agents (sage stays passive/read-only).

## Architecture

Holds the **pure-render / impure-shell** split. Two build layers, A → B; each
ships independently and is testable on its own.

---

## Layer A — Capture & classify (data)

### A1 — Provenance classifier (`lib/provenance.mjs`, NEW, pure/injectable)

The one new unit. Pure over injected readers so it unit-tests without a real
process tree:

```
classifyParent({ pid, env = {}, panes = [], ppidOf, commOf, isAgent }) ->
  { managed_by: 'human' | 'nested', parent_sid: string | null, via: 'tag' | 'tree' | 'headless' }
```

Algorithm:
1. If `env.SAGE_PARENT` is a non-empty string → `{ managed_by:'nested',
   parent_sid: env.SAGE_PARENT, via:'tag' }`. (Deterministic; the armory case.)
2. Else walk up from `ppidOf(pid)` (skip self — `pid` IS this session's own agent):
   - `panesByPid = new Set(panes.map(p => p.panePid))`
   - for up to 30 hops while `cur > 1`:
     - if `panesByPid.has(cur)` → `{ managed_by:'human', parent_sid:null, via:'tree' }`
     - if `isAgent(cur)` → `{ managed_by:'nested', parent_sid:null, via:'tree' }`
     - `cur = ppidOf(cur)`
   - fell through (headless / reparented to init) → `{ managed_by:'nested',
     parent_sid:null, via:'headless' }`

`isAgent(pid)` (also in provenance.mjs, injectable): `commOf(pid)` matches
`/^(claude|grok)$/`, OR `cmdlineOf(pid)` contains an armory/llm launcher marker
(`/armory|llm-armory|\/llm$/`). Order matters: pane check BEFORE agent check each
hop, so the human's own shell (the pane) wins before any higher agent is seen.

### A2 — proc readers (`lib/tmux.mjs`, extend)

`ppidOf` exists. Add sibling readers (same fail-open `/proc` pattern, return
`''` on any error):
- `commOf(pid)` — field 2 of `/proc/<pid>/stat` (between first `(` and last `)`).
- `cmdlineOf(pid)` — `/proc/<pid>/cmdline`, NUL-separated → space-joined.
- `windowNameForPane(pane, tmux='tmux')` — `tmux display-message -p -t <pane>
  -F '#{window_name}'`; `''` on failure.

### A3 — Emitter capture (`hooks/agentic-sage-emit.mjs`, SessionStart case)

- Replace `const pid = pidForSession(home, sid)` with `const pid = process.ppid`
  (the hook is spawned directly by the agent → ppid IS the agent pid; reliable,
  harness-agnostic, faster; drops the `~/.claude/sessions` reversal entirely). Do
  the same at the PreCompact `pidForSession` call (line ~271).
- Compute provenance once at SessionStart:
  ```
  const panes = tmuxPanes()
  const prov = classifyParent({ pid, env: process.env, panes,
                                ppidOf, commOf, isAgent })
  const pane = paneForPid(pid, panes)           // may be null
  const window_name = pane ? windowNameForPane(pane) : ''
  const agent_kind = /grok/i.test(commOf(pid)) ? 'grok'
                   : /claude/i.test(commOf(pid)) ? 'claude' : (payload.source ? 'claude' : 'unknown')
  ```
- Store new fields on the record (merge into the existing SessionStart
  `mergeRecord`): `pid`, `managed_by: prov.managed_by`, `parent_sid:
  prov.parent_sid || undefined`, `agent_kind`, `window_name: window_name ||
  undefined`, `tmux: pane || undefined`.
- `alive: isAlive(pid)` (pid is always set now — drop the `pid ? … : true`).

### A4 — Honest liveness (`lib/board.mjs`)

- Line 41: `const alive = rec.pid ? isAlive(rec.pid) : false` (was `: (rec.alive
  ?? true)`). A record with no pid can no longer read alive. New records always
  have a pid; the pid-less historical 349 become dead → collapse into counts.

### A5 — Fleet classification (`lib/fleet.mjs`)

- Rows already spread `...rec`, so `managed_by`/`window_name`/`agent_kind` flow
  through `collectSessions` untouched.
- Add `isNested(s) = s.managed_by === 'nested'` (default when absent = `false`,
  i.e. historical records are treated as human roots — but honest liveness marks
  most dead, so they collapse regardless).
- `collectFleet` totals gain `human` and `nested` counts alongside
  `sessions`/`live`/`working`. `repo.human` / `repo.nested` per repo.

### A6 — armory launcher tag (companion, `~/Repositories/llm-armory`)

- When launching a `grok-xhigh` child, inject `SAGE_PARENT=<this session's sid>`
  into the child's environment. One small change in the launcher; the emitter
  already reads it via A1. Tracked as its own task (separate repo).

### Layer A deliverable

`sage war --json` (and the roster) show `managed_by`, `window_name`, honest
`liveness`, and human/nested totals. Verifiable without any UI: a smoke test
classifies THIS live session as `human` and an armory child as `nested`.

---

## Layer B — Two-tier cockpit (display)

### B1 — Two-tier repo section (`lib/warroom.mjs`)

- `renderRepoSection` splits `repo.sessions` into `human = !isNested` and `nested
  = isNested`. Human rows render as today (but the id prefers `window_name` over
  `branch`: `nameOf(s) = s.window_name || s.branch || '(none)'`). After the human
  rows, if `nested.length`, emit one rollup row: `    … +N nested agent(s)` (dim),
  which the viewport can expand.
- Collapse the human tier: fold `/clear`-churn + ghosts — dead human rows on the
  same `(repo, branch)` collapse to a single row with a `×N` count; a session with
  no prompt and no tools and dead is dropped from the default view.

### B2 — Expand state (`lib/warnav.mjs` + `bin/sage`)

- A `Set` of expanded repoIds in the shell; the rollup row toggles its repo on
  Enter/`x`. Expanded → nested children render indented under the rollup.
- Selection ordinal already skips headers; the rollup row is selectable and acts
  as an expander.

### B3 — Panels + footer (`lib/warroom.mjs`)

- FLEET panel: `${human} managed` (headline) with `${nested} nested` beneath;
  ACTIVE stays `${live} live / ${working} working` but `live` is now honest.
- Footer gains `x expand`.

### B4 — Name + Enter (`bin/sage`)

- Rows show `window_name` (from A3). Enter on a human row → pane jump (captured
  pid, existing path). Enter on a nested row → cd-print (no own pane).

### Layer B deliverable

The cockpit the user asked for: human-managed roots named by their tmux window,
nested agents folded per repo and expandable, an honest count.

## Data flow

```
A: SessionStart → process.ppid + SAGE_PARENT/tree walk → {managed_by,parent_sid,
      agent_kind,window_name,pid} on record
   read: board(honest alive) → fleet(isNested, human/nested totals)
B: fleet → split human/nested per repo → two-tier render + rollup(+expand)
      → name = window_name → paint → draw ; Enter → pane|cd-print
```

## Error handling

- `provenance.mjs` never throws: injected readers fail-open to `''`/`0`; an
  unresolvable tree → `nested/headless` (safe default — an unclassifiable session
  is treated as a background agent, not a phantom human root).
- All new `/proc` and tmux reads are best-effort (return `''`), matching the
  existing fail-open contract. The emitter stays fail-open (exit 0).
- Historical records missing `managed_by` → treated as `human` but dead (honest
  liveness) → collapse into counts.

## Testing strategy

Layer A (TDD, node:test):
- `lib/provenance.mjs`: `classifyParent` — tag path (SAGE_PARENT → nested+parent);
  tree path human (pane pid in chain, no agent above); tree path nested (agent
  ancestor before pane); headless (no pane, chain to 1 → nested). `isAgent`
  (claude/grok comm, armory cmdline, plain node → false). All with injected
  `ppidOf`/`commOf`/`panes`.
- `lib/tmux.mjs`: `commOf`/`cmdlineOf` parse a synthetic `/proc` stat/cmdline;
  fail-open to `''`.
- `lib/board.mjs`: pid-less record → `alive:false` → `dead`.
- `lib/fleet.mjs`: `isNested`; totals split human/nested; passthrough of
  `managed_by`/`window_name`.
- **Empirical smoke (manual, documented in plan):** run the emitter's
  classification against THIS live session → expect `human`; against an armory
  child → expect `nested`. Validates the tree-walk on real `/proc` before trust.

Layer B (TDD): renderRepoSection split + rollup row; name prefers window_name;
clear-churn/ghost collapse; expand toggles nested visibility; panels show
human/nested; `❯` on exactly one row.

## Out of scope (restated)

full parent→child tree · kill/attach nested agents · OS clipboard · multi-select.
