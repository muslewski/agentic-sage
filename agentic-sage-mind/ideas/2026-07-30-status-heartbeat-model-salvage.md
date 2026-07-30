---
type: idea
summary: "Salvage ideas from unmerged feat/status-heartbeat-model (no commits worth merging): war-room MODEL column, optional sage judge desired verb, optional provider heartbeat beside pull bridge. Do not replace lib/agent-status.mjs with the branch version."
tags: [war-room, judge, heartbeat, backlog, branch-salvage]
status: active
created: 2026-07-30
updated: 2026-07-30
maturity: forming
related:
  - "[[war-room]]"
  - "[[judge-surface]]"
  - "[[session-store]]"
sources: []
---

## The idea

Read-only review of unmerged branches found `feat/desk-gate-oss` and
`feat/release-1.3.0` superseded by main. `feat/status-heartbeat-model` has
**ideas worth keeping** but **no commits worth merging** as-is. Capture them here
before those branches are deleted.

### (a) MODEL column on the war-room view

Add a MODEL column using **session model and effort fields that already exist**
on session records. Display-only; no new collection path required if main already
stores model/effort.

### (b) Optional `sage judge desired` convenience verb

A thin CLI convenience for expressing desired judge state (soft/preferred
direction already on main). Optional — not required for fleet core.

### (c) Optional provider heartbeat beside the pull bridge

An optional provider heartbeat written **alongside** the current pull bridge
(not replacing it). Observational only; keep independence from status-herald
interop rules.

## Explicit non-goal

**`lib/agent-status.mjs` must NOT be replaced with the branch's version.**
Main's version is the better direction for fleet visibility. Any salvage of
(a)–(c) must build on main's agent-status surface, not reintroduce the branch
implementation.

## Why it might matter

Without this note, branch deletion loses product intent that never landed as
mergeable commits. Small, optional UX/ops improvements once prioritized.
