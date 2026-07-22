---
type: spec
summary: "`sage war` — War-Room Cockpit design"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-10-war-room-cockpit-design.md"
related: []
sources: []
---

# `sage war` — War-Room Cockpit design

> Status: approved 2026-07-10. Gitignored per repo convention (specs/plans are
> self-contained + gitignored so worktree children only carry committed state;
> the plan files that derive from this must repeat anything they need).
> Prior round: `2026-07-10-dogfood-hardening-design.md`.

## Problem

`sage board` is per-repo: outside a git repo it dead-ends with
`sage: not a git repo (cd into a repo SAGE judges)`. Correct for the per-repo
judge scope — wrong for the **global / Hermes** use case, where the operator
(and, later, a Hermes manager agent) wants one human-facing, real-time view of
**every session across every repo** in the fleet: "see the army, watch it work."

The enumeration substrate already exists — `listRepos(home)` returns every
judged repo + session count; `collectSessions(home, repoId, now)` returns a
repo's sessions. What's missing is the aggregation + a beautiful live cockpit
on top of it.

## Decisions (locked in brainstorming)

1. **Entry point:** a dedicated verb, `sage war` — the full-screen fleet
   cockpit across all repos. `sage board` stays per-repo; outside a repo it
   stops dead-ending and instead **hints** at `sage war`.
2. **Name:** `war` (war-room brand).
3. **Layout:** **Cockpit** — a top row of stat panels (FLEET / ACTIVE / HEAT)
   over a grouped-by-repo session list. Warm-gold sage skin. Closest to
   `token-oracle dash`.
4. **Interactivity:** **full** — live repaint + raw-mode single-key controls
   (`q` quit, `a` toggle dead, `r` force refresh) + `↑↓`/pgup/pgdn scroll
   viewport whose offset survives repaints and re-clamps on resize.

## Non-negotiable constraints

- **Zero runtime dependencies.** `package.json` `dependencies` is `{}` (only
  `@biomejs/biome` as a devDep). No Ink/blessed/any TUI lib. Raw ANSI only,
  extending the existing `runWatch` alt-screen loop in `bin/sage`.
- **Fail-open, read-only.** `sage war` never writes session state and never
  throws on a malformed repo/record — a bad repo is skipped, not fatal
  (same discipline as `board`/`collectSessions`).
- **One read path** feeds both the human cockpit and `--json` (mirror how the
  `board` case shares `buildSessions()` between render and `--json`).

## Architecture

Three layers, mirroring `board`'s existing pure-render / impure-shell split
(`lib/board.mjs` pure `renderBoard`/`spinnerize`; `bin/sage` `runWatch` shell).

### `lib/fleet.mjs` (new — pure data layer)

```
collectFleet(home, now) -> {
  repos: [ { repoId, label, sessions:[…collectSessions rows…], live, working } ],
  totals: { repos, sessions, live, working, contested }
}
```

- `label` = `repoId` with the trailing `-[0-9a-f]{8}` hash stripped (matches
  how `repos` prints today).
- `live` = sessions whose `liveness` ∈ {working, idle, stalled}; `working` =
  `liveness === 'working'`. `contested` (fleet total) = sum over repos of the
  count of paths claimed/touched by >1 live session — computed by reusing the
  existing overlap detection (`mergeBrief` / `territory` lib), NOT reimplemented.
- Pure but does fs reads via the existing `listRepos`/`collectSessions`; inject
  `now`. A repo that fails to read contributes nothing (skipped), never throws.

```
filterFleet(fleet, { showAll }) -> fleet'   // drop dead/closed sessions and
                                             // zero-live repos unless showAll
sortFleet(fleet) -> fleet'                   // repos by latest activity desc
                                             // (= max session updated_at in the
                                             // repo; repos with none sort last);
                                             // sessions: working→idle→stalled→
                                             // dead→closed, then updated_at desc
```

Both pure, total, and independently testable.

### `lib/warroom.mjs` (new — pure renderers)

```
sparkline(values:number[]) -> string          // '▁▂▃▄▅▆▇█' bucketed, '' if empty
renderPanels(totals, heatValues) -> string     // 3 box-drawing panels, one row
renderRepoSection(repo, { wide }) -> string     // 'label · N sessions' + rows
renderWarRoom(fleet, {
  showAll, heatValues, scroll, rows, wide, now, clock
}) -> string                                    // full frame: panels + sections
                                                // + footer, viewport-sliced to
                                                // `rows`, scrolled by `scroll`
```

- Reuse `board`'s row vocabulary (`◆`/`●` lead glyph, `✎` dirty, `↳<row>`
  backlog, `⚠` orphan, `zone`, ctx `%`, handoff freshness) so a session reads
  the same in `war` as in `board`.
- `renderWarRoom` returns a plain multi-line string. Spinner animation is
  applied by the caller via the existing `spinnerize` mechanism (swap the lead
  glyph of `working` rows for the current frame) — extended to skip the panel
  and footer chrome lines.
- Pure: all dimensions/time injected. Snapshot-testable.

### `bin/sage` `war` case + shell (impure — the only stateful part)

- **TTY, no `--json`:** live cockpit. Extend `runWatch`:
  - alt-screen + hidden cursor (already done), plus `stdin.setRawMode(true)`.
  - **Split timers:** paint every ~100ms (spinner smoothness) off a cached
    fleet snapshot; **re-collect** the fleet every ~1000ms and on `r`. Avoids
    hammering fs at 100ms while keeping the spinner fluid.
  - **Keys:** `q`/Ctrl-C → clean teardown (show cursor, leave alt-screen,
    raw-mode off, exit 0); `a` → toggle `showAll`; `r` → force re-collect now;
    `↑`/`↓` → scroll ±1 line; pgup/pgdn → ±page; offset clamped to
    `[0, maxScroll]`, preserved across repaints, re-clamped on `SIGWINCH`.
  - Viewport `rows` = `process.stdout.rows` − chrome (panels + header + footer).
- **Non-TTY / piped:** one static `renderWarRoom` frame (no alt-screen), like
  `board` piped.
- **`--json`:** print the envelope (below) and exit; implies once.
  `--json` + `--watch` → error + exit 1 (mirror `board`).
- **`--all`:** launch with `showAll` true (same as pressing `a`).
- **`--wide`/`-w`:** append short session id (+tmux pane) to rows (as `board`).

### `sage board` not-a-repo hint

The `board` case's `sage: not a git repo (cd into a repo SAGE judges)` line
becomes `sage: not a git repo — try 'sage war' for the fleet view`. The
`--json` not-a-repo branch is unchanged (still emits the empty envelope).

## `--json` machine envelope (thin Hermes mirror)

```json
{
  "schema": 1,
  "kind": "sage.war",
  "generated_at": "<iso>",
  "repos": [
    { "repo_id": "<id>", "sessions": [ /* collectSessions rows */ ] }
  ],
  "totals": { "repos": 0, "sessions": 0, "live": 0, "working": 0, "contested": 0 }
}
```

Same `collectFleet()` result serialized — no second read path. Documented in
`SCHEMA.md` alongside `sage.board` / `sage.fleet`. This is the seed of the
Hermes cross-repo machine layer, obtained for almost nothing.

## Defaults summary

| Aspect | Default | Override |
|---|---|---|
| Mode on TTY | live cockpit | pipe → static; `--json` → envelope |
| Dead/closed sessions | hidden | `a` key / `--all` |
| Zero-live repos | hidden | `a` key / `--all` |
| Repo sort | latest activity desc | — |
| Session sort | liveness then recency | — |
| Paint tick | ~100ms | — |
| Data re-collect | ~1000ms | `r` key |
| Heat source | in-memory working-count ring buffer (~30 samples) | — |
| Session ids | hidden | `--wide`/`-w` |

## Testing

Pure layers carry the coverage; the raw-mode shell gets a smoke test only.

- **`lib/fleet.mjs`:** `collectFleet` over fixture `home` dirs — multi-repo,
  empty fleet, dead-only repo, a repo whose sessions dir is missing/garbage
  (must skip, not throw). `filterFleet` (showAll on/off drops the right rows +
  empty repos). `sortFleet` (repo + session ordering). `totals` arithmetic incl.
  `contested`.
- **`lib/warroom.mjs`:** `sparkline` ('' on empty, monotonic buckets, clamps).
  `renderPanels` snapshot. `renderRepoSection` snapshot (glyphs/zone/ctx).
  `renderWarRoom` snapshots: default, `showAll`, scrolled (offset slices the
  right window), viewport smaller than content (footer still present), empty
  fleet.
- **`bin/sage`:** `sage war --json` envelope shape (schema/kind/totals/repos)
  incl. empty-fleet; `--json --watch` → exit 1; non-TTY `sage war` → one static
  frame; `board` outside a repo prints the new hint.
- **Smoke:** spawn `sage war` on a pseudo-TTY (or with a stubbed raw-mode),
  feed `q`, assert exit 0 and that the alt-screen leave sequence
  (`\x1b[?1049l`) + cursor-show (`\x1b[?25h`) were written (no terminal left in
  raw/alt state).

## Out of scope (later rounds)

- Events-history-derived heat (parse `events.ndjson` for a real per-minute
  activity histogram) — round 1 uses the in-memory ring buffer.
- Hermes `--all` **action** verbs (cross-repo merge-brief/territory/why) built
  atop this `sage.war` envelope — a later machine-layer round.
- Mouse support; per-session drill-down pane; color themes beyond warm-gold.

## Rollout

1. Plans land as `advisor-plans/018+` (self-contained, gitignored, indexed in
   `advisor-plans/README.md`), one task per independently-testable deliverable.
2. Built by **armory grok-xhigh** children in `.claude/worktrees/` (one child
   per independent plan; sequential where they share files). Advisor (this
   session) writes prompts, monitors, reviews diffs, re-runs tests, merges
   `--no-ff`.
3. Verification per task: `npm test` (`# fail 0`) +
   `./node_modules/.bin/biome check lib bin hooks scripts install.mjs` (exit 0).
4. Update `SCHEMA.md`, usage text in `bin/sage`, `README.md` command list, and
   append a `sage war` row to `docs/dogfood-log.md` verdicts once live.
