---
type: spec
summary: "War-Room Ruled Columns + Zone Tail-Keep — Design"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-13-war-ruled-columns-design.md"
related: []
sources: []
---

# War-Room Ruled Columns + Zone Tail-Keep — Design

**Date:** 2026-07-13
**Author:** Fable advisor (brainstormed with human)
**Status:** approved-pending-review

## Problem

Human watching `sage war` reported two readability defects in the session-row grid:

1. **Whitespace desert between STATUS and ZONE.** Row template (`lib/warroom.mjs:94`):
   ```
     ● {fit(id,26)} {fit(liveness+ctx,14)} {fitZone(zone,16)} {fit(when,10)}{tail}
   ```
   The rigid grid pads every cell to a fixed width. A short status (`dead`=4, `idle`=4 → 10 blank cols) butts against an often-empty zone (16 blank cols), producing a large unbounded gap with no visual column boundary. The eye loses the row.

2. **Zone paths mangled by MIDDLE ellipsis.** `fitZone` clips the path with `clip` (middle ellipsis, `lib/warroom.mjs:24`), which drops the **leading** characters — where a path's meaning lives:
   - `syndcast/…/gallery/` → `yndcas…llery/`
   - `plans/ +1` → `lans/ +1`
   - `bin/ +1` → `in/ +1`

Human chose (visual preview, monospace = target medium): **ruled table + column header row.** All options also fix the zone truncation.

## Design

### Ruled cells (session rows)

Separate the four columns with a dim vertical rule ` │ ` (space on **both** sides — mandatory, see Color). Fixed widths unchanged (`id`=26, `status`=14, `zone`=16, `when`=10). The pad now fills a clearly-bounded cell instead of an open desert.

New `sessionRow` body line (replaces `lib/warroom.mjs:94`):

```js
return `  ${lead} ${fit(id, 26)} │ ${fit(s.liveness + ctx, 14)} │ ${fitZone(zone, 16)} │ ${fit(when, 10)}${tail ? ` ${tail}` : ''}${idw}`.replace(/\s+$/, '')
```

Everything else in `sessionRow` (lead glyph, `id` label with `window_name · branch`, `ctx`, `dead`, `when`, `zone`, `tail`, `idw`, trailing-space trim) is **unchanged**.

Total row width: `2 + 2 (lead) + 26 + 3 + 14 + 3 + 16 + 3 + 10 = 79` cols before `tail`/`idw`. The cockpit is a wide-terminal fleet view (current rows already ~73); +6 is acceptable. No wrapping logic added — a narrow terminal truncates as it does today.

### Column header row (fixed chrome)

A single label row rendered between the panels and the body, aligned to the **same grid** as the session rows (4 leading cols to clear the `  ● ` glyph column, then the same cell widths and ` │ ` rules):

```js
// Column-label header for the session grid. Aligns to sessionRow's columns:
// 4 leading cols clear the "  ● " glyph gutter, then the same widths + rules.
export const columnHeader = () =>
  `    ${fit('SESSION', 26)} │ ${fit('STATUS', 14)} │ ${fit('ZONE', 16)} │ ${fit('HANDOFF', 10)}`.replace(/\s+$/, '')
```

It is **not** part of `bodyModel` (the scrollable, attributed model) — it is fixed chrome like the panels, always visible while the body scrolls beneath it.

`renderWarRoom` inserts it (edit `lib/warroom.mjs:242`):

```js
return [
  header,
  panels,
  columnHeader(),
  ...body,
  footer(showAll, vp.scroll, vp.maxScroll, { mode, query, workingOnly, manageLabel, confirm, confirmCount }),
].join('\n')
```

### Chrome count

`WAR_CHROME` 6 → **7** (`lib/warroom.mjs:204`). Non-body lines are now header(1) + panels(4) + columnHeader(1) + footer(1) = 7. This constant is the single source of truth: `renderWarRoom`'s own height math (`lib/warroom.mjs:239`) and `bin/sage`'s `bodyHeight()` (`bin/sage:138`) both read it, so the body-height and scroll math stay correct with no `bin/sage` change. The existing self-consistency test (`test/warroom.test.mjs:188`, `lines.length == bodyCount + WAR_CHROME`) continues to hold because exactly one non-body line was added.

### Zone tail-keep (left ellipsis)

The mangling is `fitZone` clipping the path with the middle-ellipsis `clip`. Fix: a new **left-ellipsis** helper that keeps the tail (the deepest, most-specific path segment) and prefixes `…`:

```js
// Keep the TAIL of a string in `n` cols, dropping the head behind a leading … .
// For zone paths the deepest dir is the informative part; the middle-ellipsis
// clip() (right for branch ids) drops the leading char and reads as garbage.
export const clipLeft = (s, n) => {
  const chars = [...String(s ?? '')]
  if (chars.length <= n) return chars.join('')
  if (n <= 1) return chars.slice(-Math.max(0, n)).join('')
  return `…${chars.slice(-(n - 1)).join('')}`
}
```

`fitZone` swaps its inner path `clip` for `clipLeft` (edit `lib/warroom.mjs:41`); the ` +N` glob-overflow suffix handling is unchanged:

```js
const path = clipLeft(str.slice(0, -m[0].length), Math.max(1, n - [...m[0]].length))
```

Result: `syndcast/src/gallery/ +1` → `…rc/gallery/ +1` (tail kept), `plans/ +1` untouched when it fits. `clip` (middle ellipsis) is **unchanged** — the `id` column still keeps branch prefix + tail.

### Color

`lib/color.mjs` `paintLine` (`:75`) tokenizes on whitespace `/(\s+)/`. Two consequences drive the ` │ ` (space-both-sides) rule choice:

- A **lone** `│` token already maps to `dim` (`lib/color.mjs:40`, box-drawing class). Space-both-sides guarantees `│` is always a standalone token → always dims → **no color change needed for the rules.**
- A tight-abutting rule (`working│…`) would glue into one token that matches neither `^working$` nor the box class — breaking both the status color and the rule dim. Space-both-sides avoids this entirely and preserves the `sage board` + website-demo token-stream lockstep (the rules only appear in `sage war`).

**One** additive token rule for the header labels (`lib/color.mjs` `tokenColor`, near the panel-title rule at `:39`):

```js
if (/^(SESSION|STATUS|ZONE|HANDOFF)$/.test(tok)) return 'cream' // war column headers
```

These four exact uppercase words appear only in the `sage war` column header, so the board/demo streams are unaffected. `cream` matches the panel titles (FLEET/ACTIVE/HEAT), keeping chrome consistent.

## Files

- `lib/warroom.mjs` — `sessionRow` ` │ ` separators; add `clipLeft`, swap `fitZone` path clip; add `columnHeader`; insert it in `renderWarRoom`; `WAR_CHROME` 6→7.
- `lib/color.mjs` — add the 4-word header-label token rule (cream). `│` dim is already handled.
- `test/warroom.test.mjs` — `clipLeft` tail-keep; `fitZone` no longer drops leading char; `sessionRow` carries ` │ ` rules at fixed columns; `columnHeader` labels + alignment; `renderWarRoom` includes the header line (WAR_CHROME stays self-consistent).
- `test/color.test.mjs` (if present, else fold into warroom) — header labels paint cream; a lone `│` paints dim (regression guard).

## Testing strategy

Pure renderers (`sessionRow`, `columnHeader`, `clipLeft`, `fitZone`, `renderWarRoom` composition) and the color token rules are fully unit-testable — no TTY needed. The live raw-mode loop is unchanged (no key/timer edits), so no new HUMAN TTY smoke is introduced by this round; a one-line visual confirm in a real `sage war` is nice-to-have, not a gate.

## Invariants held

- Emitter/read fail-open — untouched (pure render only).
- Default-OFF — `war` is a read/interactive verb, unaffected.
- Zero runtime deps — pure string ops.
- Never hand-edit `CHANGELOG.md`.
- Pure-render split preserved — `lib/warroom.mjs`/`lib/color.mjs` stay pure; no side effects added.
- `runWarWatch` two-clock paint/data timers untouched; no key handling changed.
- `sage board` + website-demo color lockstep preserved (new tokens appear only in `sage war`).

## Out of scope (→ later)

- Per-column color theming beyond the header labels.
- Runtime-configurable / responsive column widths.
- The Layer B two-tier `+N nested` rollup + armory `SAGE_PARENT` companion — that remains **plan 024**, independent of this cosmetic pass. This ruled-columns work lands as **plan 025**.
