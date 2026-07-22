---
type: spec
summary: "Trust Hardening (`sage` #1) — Design"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-12-trust-hardening-design.md"
related: []
sources: []
---

# Trust Hardening (`sage` #1) — Design

**Status:** approved 2026-07-12 · local artifact (`docs/superpowers/specs` is gitignored; the plan is self-contained)

## Goal

Three data-trust fixes so `sage`'s live fleet count and per-event records stay
honest after the Layer A provenance work made **pid the source of truth** for
liveness:

1. **pid-recycle liveness** — a recycled pid must not resurrect a dead session.
2. **install double-fire** — an nvm/node-path switch must not append a duplicate
   hook that fires the emitter twice per event.
3. **`board --watch` 10 Hz re-collect** — decouple the fs data refresh from the
   spinner paint clock, mirroring what `war` already does.

## Context

Evidence from the live fleet + code (2026-07-12, after plan 020 merged):

- **Liveness is now pid-authoritative.** `lib/board.mjs:41` reads
  `rec.pid ? isAlive(rec.pid) : false`; `isAlive` (`lib/liveness.mjs:7`) is a bare
  `process.kill(pid, 0)` existence probe. Layer A made the honest count depend on
  this (`sage war` LIVE 164→8). A recycled pid — the OS reassigning a dead
  session's pid to an unrelated live process — reads `alive` again and
  **re-inflates the count Layer A just fixed.** Backlog: "PID-recycle liveness",
  M/MED, promoted to HIGH by Layer A.
- **Single read chokepoint.** `lib/fleet.mjs:50` and the `war` cockpit both call
  `collectSessions` (`lib/board.mjs:29`), so the `board.mjs:41` probe is the one
  place liveness is derived for board, `board --watch`, `war`, fleet, and
  `lib/self.mjs`. One fix covers all readers. The emitter (`hooks/agentic-sage-
  emit.mjs:204`) is where the pid — and now its start-time — is captured.
- **Install dedup is keyed on the full command string.** `lib/wiring.mjs`
  `_mergeSettings` pushes a hook unless some existing `h.command === command`,
  where `command` embeds the absolute `nodeExecPath`. Switching node (nvm) changes
  that path → the exact-string check misses → a **second** hook group is appended
  → the emitter fires **twice per event** (double session-record merges, double
  `events.ndjson` appends, double git spawns). The existing `staleLink` filter only
  removes entries pointing at the OLD-named hook link, not same-link/different-node
  entries. Backlog: "Install dedup keyed on full command string", S/HIGH.
- **`board --watch` re-collects every frame.** `runWatch` (`bin/sage:92`) repaints
  every `SPINNER_INTERVAL_MS` (100 ms) and its `draw` calls `build(frame)`, which
  re-runs `collectSessions` (fs read of every record) each frame = 10 Hz fs churn.
  `war` already solved this: `runWarWatch` runs two clocks — `paintTimer` at 100 ms
  and `dataTimer` at 1000 ms (`bin/sage:215-216`). Only the per-repo `board --watch`
  path still re-collects at 10 Hz. Backlog: "`board --watch` re-collects", S–M/HIGH
  (value reduced now that `war`, the flagship, is already correct — but a cheap,
  mechanical mirror of the existing pattern).

Key facts that shape the design:

- `/proc/<pid>/stat` field 22 `starttime` (jiffies since boot) is **unique per
  process lifetime** — a recycled pid gets a new value. It is **world-readable**
  (verified on `/proc/1/stat`), so the recycle check works even for a pid we can
  only `EPERM`-probe. Parsing must be **comm-safe**: field 2 (`comm`) may contain
  spaces and parentheses, so take the substring **after the last `)`** and split —
  the same trick `commOf` already uses. In that post-`)` split, `starttime` is
  index **19** (0-based; verified against a live `/proc/self/stat`).
- No `/proc` on macOS → `startTimeOf` returns `''` there. Because capture stores
  nothing when it is `''`, macOS records simply fall back to today's plain probe —
  no behavior change, no regression.
- The install fix has a stable handle: the emitter symlink path (`hookLink`) does
  **not** change across node versions, so it is the right dedup key.

## Approved decisions

- **Recycle-proof liveness by start-time match.** Capture `/proc/<pid>/stat`
  starttime at SessionStart, store it on the record as `pid_start`; at read time,
  when a `pid_start` is present, liveness = exact start-time match (mismatch or
  unreadable → **dead**). Absent `pid_start` (historical records, macOS) → today's
  `process.kill` probe. No migration; the honest bias (ambiguity → dead) is
  preserved.
- **Dedup install hooks by `hookLink`, not full command.** Drop every existing
  inner hook whose command includes our `hookLink` (or the old `staleLink`), then
  push exactly one fresh hook. Idempotent, node-path-agnostic, upgrades the node
  path in place; foreign hooks survive.
- **Two-clock `board --watch`.** Refactor `runWatch` to a `{ collect, render }`
  shape: cache the collected data, refresh it on a 1 s timer, repaint (spinner
  only) on the 100 ms timer — the exact pattern `runWarWatch` uses.
- **Out of scope:** PID-recycle protection for records written before this ships
  (they have no `pid_start` — and honest liveness already marks the pid-less
  historical pile dead, so they collapse regardless); any non-Linux recycle
  protection (no `/proc`); a full hook-registry rewrite (the targeted dedup
  suffices).

## Architecture

Pure-render / impure-shell split held. Three independent fixes; file-disjoint
except that each has its own tests. Each ships and tests on its own.

---

### Fix 1 — pid-recycle liveness

#### F1.1 — proc reader (`lib/tmux.mjs`, extend)

Add a sibling to `commOf`/`cmdlineOf` (same fail-open `/proc` pattern, `''` on any
error):

```
startTimeOf(pid) ->
  read /proc/<pid>/stat; take substring after the LAST ')'; split on whitespace;
  return token at index 19 (starttime), or '' if absent/unreadable.
```

Returns the raw jiffies token as a **string** (compare by string equality — no int
parse, no precision concern).

#### F1.2 — recycle-aware `isAlive` (`lib/liveness.mjs`)

```
export const isAlive = (pid, { startTime, startTimeOf = realStartTimeOf } = {}) => {
  if (!pid || pid < 1) return false
  if (startTime) return startTimeOf(pid) === startTime   // recycle-proof authority
  try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' }
}
```

`realStartTimeOf` is imported from `lib/tmux.mjs`; the parameter keeps the unit
injectable. When a `startTime` was captured, the start-time match **is** the
liveness test (a recycled pid or a vanished pid both mismatch → dead), so the
`kill` probe is only used on the back-compat (no-`startTime`) path. Signature stays
backward compatible: existing single-arg `isAlive(pid)` calls are unchanged.

#### F1.3 — capture at SessionStart (`hooks/agentic-sage-emit.mjs`)

- Import `startTimeOf` from `lib/tmux.mjs` (alongside the existing `tmux.mjs`
  imports added in plan 020).
- At SessionStart, after `const pid = process.ppid`:
  `const pidStart = startTimeOf(pid)`.
- Add `pid_start: pidStart || undefined` to the SessionStart `mergeRecord`.
- Leave line 204 `alive: isAlive(pid)` as is — it is a capture-time snapshot where
  the pid is definitionally live; the read-time enforcement lives in `board.mjs`.
  (PreCompact updates `pid` to the same `process.ppid`; the process — and thus its
  start-time — is unchanged across the session, so no re-capture is needed.)

#### F1.4 — enforce at read (`lib/board.mjs:41`)

```
const alive = rec.pid ? isAlive(rec.pid, { startTime: rec.pid_start }) : false
```

`rec.pid_start` is `undefined` for historical records → the `startTime` branch is
skipped → plain probe (unchanged behavior). New records carry it → recycle-proof.

---

### Fix 2 — install double-fire dedup (`lib/wiring.mjs`)

In `_mergeSettings`, replace the `staleLink`-only inner filter + the
`h.command === command` `present` check with a single "drop OURS, add current" rule
per event:

```
const ours = (h) =>
  typeof h.command === 'string' &&
  (h.command.includes(hookLink) || (staleLink && h.command.includes(staleLink)))

for (const ev of HOOK_EVENTS) {
  settings.hooks[ev] = settings.hooks[ev] || []
  for (const group of settings.hooks[ev]) {
    if (!Array.isArray(group.hooks)) continue
    group.hooks = group.hooks.filter((h) => !ours(h))
  }
  settings.hooks[ev] = settings.hooks[ev].filter(
    (g) => !Array.isArray(g.hooks) || g.hooks.length,
  )
  settings.hooks[ev].push({ hooks: [{ type: 'command', command }] })
}
```

`hookLink` is the stable emitter-symlink path (unchanged across node versions), so
this collapses any prior install of ours — old-named link *or* current link at a
different node path — to exactly one current hook per event. A foreign hook whose
command does not contain our link path is untouched.

---

### Fix 3 — two-clock `board --watch` (`bin/sage`)

Refactor `runWatch` (`bin/sage:92`) from `runWatch(build)` (where `build(frame)`
re-collects every frame) to a two-clock shape:

```
const runWatch = ({ collect, render }) => {
  const W = process.stdout
  let i = 0
  let data = collect()
  W.write('\x1b[?1049h\x1b[?25l')
  const draw = () => {
    W.write('\x1b[H\x1b[2J' + paint(render(data, SPINNER_FRAMES[i % SPINNER_FRAMES.length])) + '\n')
    i++
  }
  draw()
  const paintTimer = setInterval(draw, SPINNER_INTERVAL_MS)     // 100 ms
  const dataTimer = setInterval(() => { data = collect() }, 1000) // 1 s
  const stop = () => {
    clearInterval(paintTimer)
    clearInterval(dataTimer)
    W.write('\x1b[?25h\x1b[?1049l')
    process.exit(0)
  }
  process.on('SIGINT', stop)
}
```

Update the single board-watch call site to pass:
- `collect = () => collectSessions(home, repoId, Date.now())`
- `render = (sessions, frame) => spinnerize(renderBoard(sessions, { repoId, wide }), sessions, frame)`

fs reads drop to 1 Hz; the spinner still animates at 10 Hz. The raw-mode loop stays
manual-TTY-smoke (per the 018/019 convention); the pure pieces (`collectSessions`,
`renderBoard`, `spinnerize`) keep their existing unit tests unchanged.

---

## Data flow

```
Fix 1: SessionStart → startTimeOf(process.ppid) → pid_start on record
       read: board.mjs collectSessions → isAlive(pid,{startTime:pid_start})
              → recycle-proof alive → deriveLiveness → fleet/war/self
Fix 2: sage init → _mergeSettings → drop-ours-by-hookLink → one hook/event
Fix 3: board --watch → runWatch({collect,render}) → data@1Hz, paint@10Hz
```

## Error handling

- `startTimeOf` never throws: any `/proc` read/parse failure → `''` (matches
  `commOf`/`cmdlineOf`). A `''` at capture → no `pid_start` stored → plain probe.
  A `''` at read when a `pid_start` exists → mismatch → **dead** (honest bias; the
  pid we captured no longer presents a readable, matching stat).
- Emitter stays fail-open (exit 0); `startTimeOf` runs only inside the enabled
  SessionStart path, after the default-OFF fast exit.
- `_mergeSettings` behavior on malformed existing settings JSON is unchanged (still
  aborts with the existing message); the new filter only changes which of *our*
  hooks are pruned before the single push.
- `runWatch` SIGINT teardown clears **both** timers (regression guard: the old
  single-timer path cleared one).

## Testing strategy (TDD, node:test)

Fix 1:
- `lib/tmux.mjs` `startTimeOf`: synthetic `/proc` stat with a comm containing
  spaces and a `)` (e.g. `1234 (weird )proc) R 1 … <starttime@field22> …`) → parses
  the correct starttime; missing/garbage → `''`.
- `lib/liveness.mjs` `isAlive`: injected `startTimeOf` returning the same token →
  `true`; a different token (recycled) → `false`; `''` (gone) → `false`; no
  `startTime` arg → falls to the probe (`process.pid` → true; `1` → EPERM → true;
  an unused high pid → false).
- `lib/board.mjs`: record `{pid, pid_start}` with matching injected start-time →
  `alive:true`/`working`; mismatching → `alive:false`/`dead`; record with `pid` and
  no `pid_start` → existing plain-probe behavior (keep the current test green).

Fix 2:
- `lib/wiring.mjs` `_mergeSettings`: existing settings with our hook at an OLD node
  path → after merge, exactly ONE group for each event, command at the CURRENT node
  path; a foreign hook survives; a stale old-named-link hook is removed (preserve
  existing coverage); running the merge twice leaves exactly one (idempotent).

Fix 3:
- No automated test for the raw-mode `runWatch` loop (impure/TTY, by design — same
  as `runWarWatch`). Manual smoke documented in the plan: `sage board --watch`
  animates and refreshes; Ctrl-C restores the screen. The extracted `collect`/
  `render` are the already-tested pure functions.

Full suite: `node --test test/*.test.mjs` → `# fail 0`; `./node_modules/.bin/biome
check lib bin hooks scripts install.mjs` → exit 0.

## Out of scope (restated)

Retroactive recycle protection for pre-existing records · non-Linux recycle
protection · a hook-registry rewrite · touching `war`'s already-correct two-clock
loop · `lib/warroom.mjs`/`lib/warnav.mjs` (this round is data/install trust, not
display — Layer B / the two-tier cockpit stays its own plan).
