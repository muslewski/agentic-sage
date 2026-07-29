---
type: decision
status: accepted
date: 2026-07-29
summary: Both pull (agent-status) and push (sage register) for fleet visibility; pull first.
---

# Dual registration: pull agent-status + push `sage register`

## Context

agentic-sage is the desk's fleet judge, but it only registered sessions via
Claude Code / harness hooks. Headless `grok -p` children never fire those hooks.
On 2026-07-29 a real fleet left **138** agent-status records on disk while sage
showed **0** matching sessions (`sources/2026-07-29-fleet/sage/c05`).

Web-sage research (`web-sage/wg01`, `wg05`) treats dual registration (hooks *and*
launcher `register`/`heartbeat`) as the standard answer: liveness is a lease TTL
separate from phase.

## Decision

Ship **both** paths, **pull first**:

1. **Pull** — read the Agent Status Provider dir that launchers already write.
   Zero armory change; would have made all 138 children visible the day of the
   incident. Rows are synthetic and lossy.
2. **Push** — public `sage register` / `heartbeat` / `close` (contract C4) so
   any launcher can declare a real session with lane, corr, parent, and sid.

Real sage records always win over synthetic ones for the same process (pid
precedence; never field-merge). Synthetic rows are excluded from territory /
why-diverged / merge-brief because empty `touched_globs` would fabricate a
false all-clear.

## Why not only one path

- **Hooks only** — harness-owned; never fire for `grok -p` or non-Claude CLIs.
- **Push only** — needs every launcher to cooperate; we would still be blind to
  today's armory children until every launcher is updated.
- **Pull only** — cannot carry lane / fleet_run / parent_sid / corr that the
  launcher knows and the status file may omit.

The launcher is the only process guaranteed to run for a headless child; pull
needed zero cooperation and shipped first so the board is useful immediately.

## Consequences

- `lib/agent-status.mjs` + board/fleet merge (synthetic outside `repoCache`).
- `lib/register.mjs` + `sage register` CLI; exit 0 on soft-fail, 2 on usage error.
- LIVE rollup by lane past a viewport budget (`lib/rollup.mjs`).
- Fleet-wide `sage prune --all` for 2k+ historical records.
