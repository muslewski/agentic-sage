---
type: zone
summary: "Full-screen `sage war` cockpit — warroom layout, faces/clash memory, keyboard/mouse nav, hot-float panes, color paint, spinners, and tmux pane mapping for live multi-repo session oversight."
tags: [war-room, tui, tmux]
status: seeded
created: 2026-07-21
updated: 2026-07-21
verifiedAt: unverified
owns:
  routes: []
  testids: []
  globs:
    - "lib/warroom.mjs"
    - "lib/warfaces.mjs"
    - "lib/warnav.mjs"
    - "lib/mouse.mjs"
    - "lib/hotfloat.mjs"
    - "lib/color.mjs"
    - "lib/spinner.mjs"
    - "lib/tmux.mjs"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

Interactive TTY cockpit over fleet data: ruled columns, sticky viewport, face modes and clash memory, selection/filter/kill navigation, mouse enable sequences, floating hot panes, ANSI color helpers, spinner frames, and pid→tmux pane/window mapping used for jump-to-session.

## Anchors

Large pure-render modules driven by `sage war` in the CLI. Separate from one-shot `board`/`fleet` text so the hot-path re-collect caches stay localized in board/fleet while chrome lives here.

## Invariants

Prefer empty until verified.

## Lineage

docs/superpowers war-room design notes (in tree), lib/warroom.mjs and related headers, demo war tapes, 2026-07-21 atlas-seed pass.
