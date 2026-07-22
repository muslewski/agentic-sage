---
type: spec
summary: "War Faces — LIVE · CLASH · MEMORY"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-14-war-faces-live-clash-memory-design.md"
related: []
sources: []
---

# War Faces — LIVE · CLASH · MEMORY

**Status:** approved 2026-07-14 · implemented (plan 027)  
**Author:** Grok 4.5 (brainstormed with human)  
**Inspiration:** token-oracle `‹ Past · Present · Future ›` + ←/→ cycle  
**Depends on:** war cockpit (018–019), nested rollup (024), live-only contested, name|branch|zone layout  

> Specs are gitignored; implementation plans under `advisor-plans/` must be self-contained.

---

## Goal

Give `sage war` **three functional faces** — not three filters of the same table.  
Same muscle memory as token-oracle (←/→ + header tabs). Each face answers a different fleet question and shows **different structure**, so the switch has a wow effect and real utility.

| Face | Question | Wow |
|------|----------|-----|
| **LIVE** | Who is the living army right now? | Clean name/branch/status/zone roster (current default, refined) |
| **CLASH** | Where will merges hurt? | Contested-path cockpit — merge-brief as a visual face |
| **MEMORY** | What residue did we leave? | Graveyard: dead/closed/ghosts, manage + bulk clear first-class |

---

## Non-negotiables

- Zero runtime deps; pure ANSI TUI (extend existing war loop).
- Fail-open, read-only except MEMORY deletes (record files only — never `process.kill`).
- Live-only contested (dead ghosts must not inflate CLASH).
- Wrap-safe: every line `≤ term cols`; layout via `layoutFor`.
- Paint clock must **not** rebuild heavy models every 100ms (keep model cache pattern).
- Tabs change the **question**; toggles (`z` `n` `w` `/`) are **lenses inside a face**.

---

## Interaction (oracle-shaped)

### Header tab bar

Replace or extend the war header line:

```text
⚔  SAGE WAR ROOM · fleet     ‹ LIVE · CLASH · MEMORY ›     12:00:00
```

- Active face: bright/cream; inactive: dim.
- Narrow terminals: `‹ LIVE ›` or short `L · C · M` with active expanded.

### Keys

| Key | Action |
|-----|--------|
| `←` / `→` (CSI `D`/`C`) | Cycle faces LIVE ↔ CLASH ↔ MEMORY |
| `[` / `]` | Same cycle (fallback if arrows awkward in raw mode) |
| `1` / `2` / `3` | Jump LIVE / CLASH / MEMORY |
| `?` | Help (lists faces + keys) |
| existing keys | Face-scoped (see below) |

Arrow keys for **selection** stay `↑↓` / `j k`. Horizontal arrows are **reserved for faces** (oracle pattern). No conflict with filter mode (printable only).

### State

```js
const FACES = ['live', 'clash', 'memory']
let face = 'live' // default
// per-face: scroll, selOrd, query optional (filter can reset or stay — prefer per-face query)
```

Switching face: reset scroll to 0, rebuild model for that face, keep fleet cache.

---

## Face 1 — LIVE (default)

**Data:** `filterFleet(fleet, { showAll: false })` + nested fold + current columns.

**Body:** current session grid:

```text
NAME | BRANCH | STATUS | ZONE | AGE
```

**Toggles (LIVE only, or global where harmless):**

- `z` zone, `n` nested, `w` working-only, `/` filter, `↵` enter session, `c` cd, `m`/`X` available but secondary (footer de-emphasize vs MEMORY).

**Empty:** calm “no live sessions”.

**Panels:** keep FLEET / ACTIVE / HEAT as today (live-first totals).

---

## Face 2 — CLASH (the functional wow)

**Question:** contested surface across the fleet — not a session list.

### Data shape (pure)

Build from already-loaded fleet rows (no second full-disk mergeBrief pass if possible):

```js
// per repo, from live sessions only:
// path → [sessions that touch it]
// keep paths with ≥2 live sessions
// also union claimed_globs overlaps when cheap (v1: touched only OK)

clashModel = {
  repos: [{
    repoId, label,
    paths: [{
      path, generated,
      sessions: [{ session_id, window_name, branch, liveness, worktree, pid }]
    }]
  }],
  totals: { paths, reposWithClash, sessionsInvolved }
}
```

Reuse `contestedCount` logic extended to **list** paths (export `contestedPaths(rows)` from fleet or territory pure helper over in-memory rows).

### Body render (different structure)

```text
▌ agentic-sage · 3 paths
  ⚔ lib/warroom.mjs                              [generated?]
      sage · main          working
      hermes · advisor/…   idle
  ⚔ bin/sage
      …
▌ status-herald · clear
```

- Path rows are selectable (primary cursor targets).
- Nested session lines under a path are selectable too (optional v1: only path rows selectable; Enter on path jumps to first live session).
- **Empty fleet clash:** big calm center line: `clear — no live contests`.

### Keys on CLASH

| Key | Action |
|-----|--------|
| `↵` | Jump to selected session (or first session on path) |
| `c` | cd that session’s worktree |
| `/` | filter paths / branches / names |
| `w` | only paths involving a `working` session |
| `m` / `X` | **no-op or flash** “use MEMORY for dead” — do not delete from CLASH |

### Panels on CLASH

Rewrite HEAT/ACTIVE copy for the face:

- FLEET: `N repos` · `P clash paths`
- ACTIVE: `S sessions in clash`
- HEAT: `contested P` or spark of clash count history

---

## Face 3 — MEMORY (graveyard, proud)

**Data:** dead + closed only (and optionally stalled-long if we want later — v1: dead|closed).  
Apply `collapseChurn` aggressively. Nested dead folded unless `n`.

**Body:** same session grid columns as LIVE but:

- Default sort: newest `updated_at` among terminal.
- Repo bands: `+N ghosts · +N churn` emphasized.
- STATUS shows `dead` / `closed` in red (existing paint).

**Keys on MEMORY**

| Key | Action |
|-----|--------|
| `m` | manage selected dead row |
| `k` (in manage) | kill one record |
| `X` then `y` | clear all dead/closed (primary CTA) |
| `↵` | if killable, enter manage? or cd worktree of last home — prefer **cd print** only |
| `a` | **no-op** (already all-dead face) or toggle “include stalled” later |

**Footer on MEMORY:** lead with clear action:

```text
 ↑↓ move · X clear×N · m manage · ? help · ←→ faces · q quit
```

**Panels on MEMORY:**

- FLEET: `N repos` · `D dead`
- ACTIVE: `G ghosts` · `C churn`
- HEAT: dim / `archive` — not “hot”

---

## Architecture

### Pure modules

| Piece | Where | Notes |
|-------|--------|------|
| `FACES`, `nextFace`, `prevFace` | `lib/warfaces.mjs` (new) or warroom | pure |
| `renderTabBar(face, cols, clock)` | warroom / warfaces | pure, wrap-safe |
| `buildClashFromFleet(fleet)` | fleet.mjs or clash.mjs | pure over in-memory rows |
| `bodyModelLive` | existing bodyModel | rename mentally |
| `bodyModelClash` | new pure | path tree model + selectable indices |
| `bodyModelMemory` | bodyModel + filter terminal + collapse | |
| `renderWarRoom` | branch on `face` | panels + body + footer face-aware |

### Shell (`runWarWatch`)

```js
let face = 'live'
// on ←/→/1/2/3: face = …; scroll=0; rebuildModel(); draw()
// rebuildModel switches builder by face
// refresh(): always collectFleet once; derive live view, clash model, memory view, deadCache
```

**Perf:** one `collectFleet` per data tick; derive all three pure views; only paint active face’s model. MEMORY show-all cost already mitigated (2.5s timer when heavy — apply when face===memory).

### Selectable model

CLASH path rows need `session` or `clashTarget` on model entries:

```js
{ text, isHeader, session, clashPath, selectable: true }
```

`selectableIndices` already skips headers; path rows are non-headers. Nested indent lines can carry `session` for Enter.

---

## Footer / help

- Global: `←→ faces` or `‹› faces` always in compact footer when space allows.
- Face-specific primary actions as above.
- Help overlay: three sections LIVE / CLASH / MEMORY key maps.

---

## Testing

1. Pure: `nextFace` cycle; tab bar width ≤ cols; active mark.
2. Pure: `buildClashFromFleet` — 2 live same path → 1 clash; dead co-touch → ignore.
3. Pure: MEMORY model only terminal liveness.
4. Pure: render snapshots for empty CLASH / empty MEMORY / busy LIVE.
5. No regression: LIVE defaults match current columns + zone on.

---

## Out of scope (v1)

- Per-parent nested tree expand (still open 024 remainder).
- Killing live processes.
- Hermes-only faces / separate binary.
- Editing claims from CLASH.
- Animated tab transitions.

---

## Implementation order (for later plan)

1. Tab bar + face state + ←→/123 (LIVE body only — wire plumbing).
2. MEMORY face (mostly filters + footer + panels).
3. CLASH data + body renderer + empty calm.
4. Help + footer face awareness + tests + dogfood.

---

## Success criteria

- User can switch faces without reading help (header ‹ LIVE · CLASH · MEMORY › + arrows).
- LIVE stays the beautiful roster.
- CLASH shows **paths**, not the same session table filtered.
- MEMORY makes bulk clear feel like the right place.
- No wrap regression; no 1.4s double-read regression.
- Suite green; TTY smoke: ←→ changes body shape, not just a chip.
