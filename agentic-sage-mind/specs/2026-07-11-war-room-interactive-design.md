---
type: spec
summary: "`sage war` Interactive — Design"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-11-war-room-interactive-design.md"
related: []
sources: []
---

# `sage war` Interactive — Design

**Status:** approved 2026-07-11 · local artifact (docs/superpowers/specs is gitignored)

## Goal

Make the `sage war` cockpit navigable: select a session row and **enter** it —
tmux-jump to the live pane, or fall back to printing its location. Add a couple
of per-session actions and a filter so a 28-row fleet is reachable fast.

## Context

`sage war` today renders a read-only cockpit: header + 3 stat panels + a
scrollable, sticky-banded session body + footer. `↑↓/pgup/pgdn` scroll the body;
`a` toggles dead, `r` refreshes, `q` quits. There is **no cursor** and no way to
act on a session.

Fleet facts that shape this:
- Sessions are addressed by `session_id`; the fleet is **mixed-agent** (Claude
  Code, Grok Build, others).
- Each session record carries `pid`, `worktree` (absolute repo path), `branch`,
  `liveness`. It does **not** store a tmux target or the agent kind.
- `lib/tmux.mjs` resolves a live `pid → pane` (`session_name:window_index`)
  best-effort, agent-agnostic. This is the hook for "enter the live pane".

## Approved decisions

- **Enter = tmux jump + cd fallback.** Live tmux pane → jump. No pane / dead →
  tear the cockpit down and print `cd <worktree>` + sid for a manual resume.
  Agent-agnostic; no guessing the agent binary.
- **This round:** selection cursor + Enter, per-session `c` (cd-print), and a
  filter. **Not** in scope: dupe-collapse (a session-*creation* fix, deferred),
  resume-exec (needs agent kind sage doesn't track), OS clipboard (not zero-dep),
  kill/mark (sage is a **passive, read-only** judge — SIGTERM breaks that
  contract).
- **Highlight** = plain-text marker: the selected row swaps its leading `  ` for
  `❯ `, painted bright downstream. No reverse-video in the pure layer, so
  renderers stay testable.
- **↑↓ now moves the selection** (was scroll); the viewport auto-scrolls to keep
  the selection visible. Sticky bands still pin.

## Architecture

Holds the established **pure-render / impure-shell** split. Pure navigation +
filter live in a new `lib/warnav.mjs` and small `lib/warroom.mjs` additions (unit
tested). The raw-mode input state machine, tmux exec, and teardown live in
`bin/sage runWarWatch` (manual TTY smoke, like the existing live loop).

### Unit 1 — attributed body carries the session handle

`bodyModel` (lib/warroom.mjs) already tags each line with `isHeader` + governing
`header`. Extend row entries with the underlying session object so the cursor
maps to real data. Rows zip to `repo.sessions` by index (renderRepoSection emits
`[head, ...sessions.map(sessionRow)]`):

```
header entry: { text, header, isHeader: true,  session: null }
row entry:    { text, header, isHeader: false, session: repo.sessions[i] }
```

### Unit 2 — selection engine (lib/warnav.mjs, pure)

Selection is tracked as an **ordinal** over selectable (non-header) rows, so
moving is a clamped ±1 independent of bands.

- `selectableIndices(model) -> number[]` — model indices where `!isHeader`.
- `moveSelection(count, ord, delta) -> number` — clamp `ord+delta` to
  `[0, count-1]` (count = selectableIndices length; `0` when empty → caller shows
  no cursor).
- `selectedModelIndex(model, ord) -> number | null` — ordinal → model index (null
  when no selectable rows).
- `ensureVisible(idx, scroll, height, len) -> number` — new scroll so the
  selected model `idx` renders, reserving the top line for a (possibly pinned)
  band:

  ```
  maxScroll = max(0, len - height)
  if idx <= scroll:            newScroll = max(0, idx - 1)   // one line of context above
  else if idx >= scroll+height: newScroll = idx - height + 1
  else:                        newScroll = scroll
  return clamp(newScroll, 0, maxScroll)
  ```

  `idx - 1` keeps the selected row at view-row ≥ 1, so the sticky band on row 0
  never hides it — this is what makes selection + sticky coexist. Test table:

  | idx | scroll | height | len | → newScroll |
  |----:|-------:|-------:|----:|------------:|
  |   1 |      0 |      6 |  20 |           0 |
  |   0 |      0 |      6 |  20 |           0 |
  |   8 |      0 |      6 |  20 |           4 |
  |   3 |      5 |      6 |  20 |           2 |
  |  19 |      0 |      6 |  20 |          14 |

### Unit 3 — sticky viewport marks the selection (lib/warroom.mjs)

`stickyViewport` currently returns `lines: string[]`. Evolve it to return
windowed **entries** with their model index, so the caller can mark the selected
row and still know the pinned header is synthetic:

```
stickyViewport(model, { scroll, height, selected }) ->
  { rows: [{ text, modelIndex|null, stuck?: true }], scroll, maxScroll, stuck }
```

- pinned band is a synthetic row: `{ text: header, modelIndex: null, stuck: true }`.
- `markSelected(text)` (pure) — replace a leading `  ` (two spaces) with `❯ `;
  `renderWarRoom` applies it to the row whose `modelIndex === selected`.
- `bodyLines` back-compat wrapper stays (`model.map(m => m.text)`), used by the
  non-scrolling static path + demo lockstep.

`renderWarRoom` gains a `selected` (model index) param; static/non-TTY and
`--json` paths pass `selected: null` (no cursor).

### Unit 4 — filter (lib/warnav.mjs pure + bin/sage input)

Pure predicate applied to the fleet **before** `bodyModel`:

```
matchFleet(fleet, { query = '', workingOnly = false }) -> fleet
  q = query.trim().toLowerCase()
  repos = fleet.repos
    .map(r => ({ ...r, sessions: r.sessions.filter(s =>
      (!workingOnly || s.liveness === 'working') &&
      (!q || `${r.label} ${s.branch || ''}`.toLowerCase().includes(q)))}))
    .filter(r => r.sessions.length > 0)
  return { repos, totals: fleet.totals }   // panels stay fleet-wide
```

Impure input state in `runWarWatch`: `mode ∈ {nav, filter}`, `query` string.
- `nav`: `↑/k`,`↓/j` move selection; `PgUp/PgDn` ±(height-1); `Enter` enter; `c`
  cd-print; `/` → filter mode; `w` toggle workingOnly; `a` toggle showAll; `r`
  refresh; `q`/`Ctrl-C` quit.
- `filter`: printable keys append to `query`; Backspace pops; `Esc` clears query
  + →nav; `Enter` keeps query + →nav. Footer shows `/<query>▌`. After any query
  change, re-clamp the selection ordinal to the filtered selectable count.

### Unit 5 — Enter + cd-print actions (bin/sage, impure)

```
enterSelected():
  s = model[selectedModelIndex]?.session; if (!s) return
  pane = paneForPid(s.pid, tmuxPanes())          // lib/tmux.mjs, best-effort
  teardownCockpit()                               // alt-screen off, cursor on, raw off, timers cleared
  if (pane) {
    if (process.env.TMUX) execFileSync('tmux', ['switch-client', '-t', pane], { stdio: 'inherit' })
    else spawnSync('tmux', ['attach-session', '-t', pane.split(':')[0]], { stdio: 'inherit' })  // then select-window
    process.exit(0)
  }
  console.log(`cd ${s.worktree}`)
  console.log(`# session ${String(s.session_id).slice(0,8)} (${s.branch || '—'}) — resume in your agent`)
  process.exit(0)

cdPrintSelected(): same teardown + the two console.log lines + exit(0)  // forced, even for live panes
```

- Inside `$TMUX`, `switch-client` returns immediately; sage exits and the user is
  in the target pane.
- Outside `$TMUX`, `attach-session` inherits stdio and blocks until the user
  detaches; then sage exits.
- Best-effort: any tmux failure falls through to the cd-print branch.

## Data flow

```
collectFleet → filterFleet(showAll) → matchFleet(query,workingOnly) → sortFleet
   → bodyModel(+session) → [selection ordinal → selectedModelIndex]
   → ensureVisible → stickyViewport(selected) → renderWarRoom → paint → draw
Enter: selectedModelIndex → model[].session → paneForPid → tmux | cd-print
```

## Error handling

- `paneForPid`/`tmuxPanes` already never throw (return null/[]). Enter falls back
  to cd-print on any miss.
- Empty fleet or empty filtered set → no selectable rows; cursor hidden; Enter/c
  are no-ops.
- Selection ordinal is re-clamped on every refresh, filter change, and showAll
  toggle (fleet size shifts).
- tmux exec wrapped; failure → cd-print fallback, never a stack trace on the
  user's terminal (teardown has already restored the screen).

## Testing strategy

Pure units are TDD'd (node:test):
- `lib/warnav.mjs`: selectableIndices, moveSelection (clamp at both ends, empty),
  selectedModelIndex, ensureVisible (the table above), matchFleet (query,
  workingOnly, totals preserved, repo drops when empty).
- `lib/warroom.mjs`: bodyModel row carries `session`; stickyViewport returns
  entries + marks `selected`; markSelected swaps the lead; renderWarRoom with a
  `selected` index shows `❯` on exactly one row; `selected:null` shows none.
- `lib/color.mjs`: `❯` painted bright.

Impure (manual TTY smoke, documented in the plan, no automated test): the Enter
tmux jump (inside + outside `$TMUX`), cd-print, filter typing, selection+scroll
feel. This mirrors plan 018's live-loop smoke step.

## Out of scope (restated)

dupe-collapse · resume-exec · OS clipboard · kill/mark · multi-select.
