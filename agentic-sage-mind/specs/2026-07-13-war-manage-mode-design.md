---
type: spec
summary: "War-Room Manage Mode — Kill Dead Sessions — Design"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-13-war-manage-mode-design.md"
related: []
sources: []
---

# War-Room Manage Mode — Kill Dead Sessions — Design

**Date:** 2026-07-13
**Author:** Fable advisor (brainstormed with human)
**Status:** approved (human: "sounds good bro")

## Problem

`sage war` accumulates dead/closed session records forever. `SessionEnd` only marks a record `closed`; a crash becomes `dead` via Layer A's pid-less liveness. Nothing deletes records — `collectFleet` scans every file each refresh, so the board fills with dead clutter. The only removal path is the bulk CLI `sage prune [--days N] [--yes]` (`bin/sage:467` → `fs.rmSync(sessionFile(home, repoId, sid))`), which is invisible from the live dashboard. The human wants to clear dead sessions **from the war panel itself**, by entering a management state and picking an action (not scattering one-off keystrokes across nav).

## Design

### State machine

`runWarWatch` already has `mode ∈ {'nav','filter'}`. Add **`'manage'`**. Manage mode targets the currently-selected session and shows an action menu in the footer. A nested bulk-confirm is a boolean flag `confirm` (true → footer shows a `y/n` prompt), not a third mode.

```
nav --(m, row selected)--> manage
manage --(esc)--> nav
manage --(k)--> [kill selected if terminal] --> nav
manage --(X)--> manage+confirm
manage+confirm --(y)--> [clear all dead] --> nav
manage+confirm --(n | esc)--> manage
```

### Keys

Nav mode gains one advertised key:
- **`m`** — enter manage mode for the selected session (no-op if nothing selectable).

Manage mode:
| key | action |
|---|---|
| `k` | kill the selected session — delete its record IF `killable` (dead/closed). Live row → set a transient `flash` ("live — not killable"), stay in manage. |
| `X` | begin bulk clear — set `confirm=true`, footer shows `clear N dead session(s)? y/n` where N = count of all dead/closed across the fleet. |
| `esc` (`\x1b`) | back to nav (also cancels a pending confirm). |
| (confirm) `y` | delete every dead/closed record across the fleet, refresh, return to nav. |
| (confirm) `n` | cancel confirm, stay in manage. |

After any successful delete: `refresh()` then `draw()`, and `mode='nav'`.

### Killable rule (pure, `lib/warnav.mjs`)

```js
export const isKillable = (s) => !!s && (s.liveness === 'dead' || s.liveness === 'closed')
```

Live sessions (`working`/`idle`/`stalled`) are **never** killable in this round. "Kill a live agent" means `process.kill(pid)` — a bigger, riskier escalation, deliberately out of scope. This round only removes terminal RECORDS (no process is ever signalled).

### Bulk target collection (pure, `lib/warnav.mjs`)

```js
export const collectDead = (fleet) =>
  (fleet.repos || []).flatMap((r) => (r.sessions || []).filter(isKillable))
```

Each returned record carries `repo_id` + `session_id` (confirmed present on every record), which is exactly what `sessionFile(home, repo_id, session_id)` needs. Bulk operates on a FRESH `collectFleet(home, now)` (the whole fleet, not the filtered `view`) so "clear all dead" clears even dead rows hidden by the current filter — that is the point of the sweep.

### Deletion path

Reuse the proven prune mechanic, per-record, fail-open:

```js
try { fs.rmSync(sessionFile(home, s.repo_id, s.session_id)); } catch {}
```

Never throws into the render loop. A record missing `repo_id`/`session_id` is skipped (the `try` swallows the bad path).

### Footer (pure, `lib/warroom.mjs`)

`footer(showAll, scroll, maxScroll, opts)` gains `mode:'manage'`, plus `manageLabel`, `confirm`, `confirmCount` in opts:

```js
if (mode === 'manage') {
  if (confirm) return ` clear ${confirmCount} dead session(s)? y/n`
  return ` manage ‹${manageLabel}›   k kill · X clear all dead · esc back`
}
```

Nav footer gains `· m manage` (additive — existing `assert.match` substring tests are unaffected). `manageLabel` = the selected session's `window_name · branch` (fallback `branch`, fallback 8-char sid) — a short identity echo so the human sees what they're about to kill.

### Rendering the target echo + flash

`renderWarRoom` passes the new footer opts through from `runWarWatch` state. The `flash` message (live-not-killable) is shown by temporarily overriding `manageLabel` with the flash text for one paint, cleared on the next keypress — no new render parameter needed beyond what manage mode already threads.

## Files

- `lib/warnav.mjs` — add `isKillable`, `collectDead` (pure).
- `lib/warroom.mjs` — `footer` manage-mode branch + nav `m manage` hint; thread opts through `renderWarRoom`.
- `bin/sage` — `runWarWatch`: `manage` mode state, `m`/`k`/`X`/`esc`/`y`/`n` handling, `fs.rmSync` deletion, refresh.
- `test/warnav.test.mjs` — `isKillable`, `collectDead`.
- `test/warroom.test.mjs` — footer manage menu + confirm prompt.

## Testing strategy

Pure decision logic (`isKillable`, `collectDead`, `footer` manage/confirm text) is unit-tested. The raw-mode key wiring + `fs.rmSync` side effect is TTY-only and follows the plan-018/019 precedent: **HUMAN TTY smoke pending** (enter `m`, `k` a dead row, `X`→`y` bulk clear, `esc` cancel). The plan states this explicitly; it is not a test gap to paper over.

## Invariants held

- Emitter/read fail-open (deletion wrapped in try/catch; never throws into the loop).
- Default-OFF unaffected (war is a read/interactive verb).
- Zero runtime deps (only `node:fs` + existing modules).
- Never hand-edit `CHANGELOG.md`.
- Pure-render split preserved: `lib/warroom.mjs`/`lib/warnav.mjs` stay pure; the `fs.rmSync` side effect lives only in `bin/sage`.
- `runWarWatch`'s two-clock paint/data timers untouched.

## Out of scope (→ later)

- Killing/terminating LIVE sessions (`process.kill`).
- Undo/trash (deletion is immediate; records are historical, low-stakes).
- The Layer B two-tier `+N nested` rollup + armory `SAGE_PARENT` companion (that is plan 024).
- Other manage-mode actions (rename, pin) — the menu is built to extend, but only `kill`/`clear` ship now.
