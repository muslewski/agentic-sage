---
type: zone
summary: "Optional Sage Island Tauri desktop — top-edge glass fleet dock over sage --json; soft actions; Mac-first; not part of npm CLI package."
tags: [desktop, island, tauri, ui, optional]
status: seeded
created: 2026-07-31
updated: 2026-07-31
verifiedAt: unverified
owns:
  routes: []
  testids: []
  globs:
    - "desktop/**"
  tools: []
depends: []
invariants: []
skills: []
related:
  - "[[judge-surface]]"
  - "[[war-room]]"
  - "[[cli]]"
sources:
  - "agentic-sage-mind/specs/2026-07-31-sage-island-desktop-design.md"
---

## What this is

Optional Mac-first desktop companion: frameless always-on-top glass **island** at
the top edge of the screen. Polls `sage board --json` (and heat from merge-brief
when JSON is usable), shows hybrid session pills, peek/pin expand, soft actions
(copy / open path). Does not own fleet state and does not ship inside the
published `agentic-sage` npm tarball.

## Anchors

- `desktop/src-tauri/` — Tauri window flags, `run_sage`, clipboard, open path
- `desktop/src/lib/` — density, labels, sageClient, windowFit
- `desktop/src/components/` — Island, Peek, ExpandPanel
- `desktop/src/routes/+page.svelte` — poll + interaction state machine

## Invariants

- Soft actions only in v1 — no claim/register/guard from the UI
- Fail-open empty states when sage is missing or the board is empty
- Root `package.json` must not gain desktop runtime dependencies
