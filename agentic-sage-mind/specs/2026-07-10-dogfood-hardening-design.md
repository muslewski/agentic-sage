---
type: spec
summary: "Dogfood-Hardening Round — Design (verify-first)"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-10-dogfood-hardening-design.md"
related: []
sources: []
---

# Dogfood-Hardening Round — Design (verify-first)

Date: 2026-07-10
Status: approved (brainstorm session "agentic sage")
Execution mode: Fable advisor + `armory grok-xhigh` executor children (see using-llm-armory skill)

## Context

agentic-sage is a passive, fail-open, default-OFF fleet judge. The owner wants to start
real dogfooding across 4–8 parallel sessions spanning two harnesses (Claude Code + Grok
CLI), including background `armory grok-xhigh -w <name> -p "..."` executor children in
git worktrees. Longer-term consumers: a "war-room" dashboard round (oracle plan-034
conventions, warm-gold sage skin) and a Hermes manager-agent machine layer. This round
delivers neither — it makes the underlying truth trustworthy first.

Decisions taken during brainstorm:

- **Order**: dogfood hardening first; dashboard round second; Hermes machine layer third.
- **Scope**: global install, both harnesses (`~/.claude` + `~/.grok`), agent-home storage.
- **Success bar**: `sage board` shows interactive sessions AND background grok executor
  children (worktree + branch), across repos.
- **Approach**: verify-first. sage's fail-open design makes failures silent — an empty
  board is indistinguishable from an idle fleet — so a verification harness precedes and
  gates the live switch-on.

## Goal

sage ON globally and *trusted*: every real session type provably lands in
`sessions/<sid>.json`, `events.ndjson`, and `sage board` output. A minimal versioned
`--json` machine layer rides along as the seed of the future Hermes surface.

## Components

### 1. Verification harness

`scripts/verify-fleet.mjs` plus a test file following the existing
`test/init-wizard.test.mjs` pattern. Runs in an isolated environment: temp git repo,
sandboxed `SAGE_STORAGE_ROOT`, temp agent home. Two layers:

- **Emitter-level (scripted, deterministic)**: invoke `hooks/agentic-sage-emit.mjs` with
  realistic stdin payloads for both dialects — Claude (`hook_event_name`, `session_id`)
  and Grok (`hookEventName`/snake_case + `GROK_*` env fallbacks) — covering all 7 wired
  events (SessionStart, UserPromptSubmit, PostToolUse, Stop, PreCompact, SessionEnd,
  PreToolUse/guard). Assert: record fields per schema (link_state, liveness, gitSignals,
  timestamps), events.ndjson lines, and that `sage board` renders the session.
- **Live smoke (opt-in behind `SAGE_E2E_LIVE=1`)**: launch one real `grok -p` child inside a
  `.claude/worktrees/<name>` worktree; assert it appears on the board with worktree and
  branch. Claude interactive coverage is a manual checklist in the friction log — not
  worth burning advisor-lane tokens on spawn tests.

### 2. Grok as first-class citizen

- `sage init --global` must wire the native Grok side (`~/.grok` hooks/settings) — the
  harness profile exists in `lib/harness.mjs`; verify `wireAll` actually writes it, fix
  if it only writes `~/.claude`.
- Finish `templates/GROK.snippet.md` (currently untracked/incomplete).
- **Critical unknown**: does `grok -p` print mode fire hooks at all? Verified, not
  assumed. If it does not → minimal fallback shim at the armory launcher: emit
  SessionStart/SessionEnd by invoking the emitter directly around the child process.
  (Shim lives in llm-armory repo; sage only documents the contract.)

### 3. Worktree identity

Executor children run in `.claude/worktrees/<name>`. Repo-id resolution must map a
worktree to its parent repo (wiring code claims worktree safety — test it, fix if it
splits identity). Board row for a child shows worktree path and branch.

### 4. `--json` on `board` and `fleet`

- Versioned envelope: `{ "schema": 1, "generated_at": ..., "sessions": [...] }` —
  mirrors token-oracle's `forecast.json` schema-1 convention.
- Shares `collectSessions` with the human render; no second read path.
- One-page schema doc at `SCHEMA.md` so external consumers (future Hermes) have a
  stable contract.
- Nothing more: no `--all` cross-repo verb, no other verbs — that's the Hermes round.

### 5. Go live

`sage init --global` (both harnesses, agent-home storage), `sage on`, `sage doctor`
clean. Start `docs/dogfood-log.md` friction log. One week live before speccing the next
round (dashboard).

## Data flow

Unchanged: hooks → emitter → store (`sessions/<sid>.json` + `events.ndjson`). New code
is read-side only (`--json`) plus wiring fixes.

## Error handling

- Emitter fail-open invariant untouched: any error → exit 0, never blocks a session.
- The verification harness is where failures become loud; production stays silent-safe.
- `--json` is fail-open too: on empty/error, emit a valid empty envelope, exit 0.

## Testing

- Harness joins the npm test suite; live smoke behind an env flag (no external calls in
  default test runs).
- Verification commands for executors: repo's standard test invocation (`npm test`) +
  `node scripts/verify-fleet.mjs` in sandbox mode.

## Out of scope

Dashboard work beyond the existing board, backlog/adapter features, statusline polish,
Hermes verbs beyond `--json` on board/fleet, any push/daemon real-time mechanism.

## Open technical questions (resolved during implementation, answers recorded here)

1. Does `grok -p` print mode fire hooks? (→ shim decision, §2)
2. Does `wireAll` write native `~/.grok` wiring today or only compat via `~/.claude`?
3. Does repo-id resolution already survive `.claude/worktrees/` linked worktrees?
