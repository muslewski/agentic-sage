---
type: decision
summary: "Removed six vendored atlas skill copies from this repo; single source is memory-atlas package skills installed at user scope (~/.claude/skills/). One divergent copy (atlas-recollection) was stale, not an improvement."
tags: [atlas, skills, vendoring, drift, user-scope]
status: active
created: 2026-07-30
updated: 2026-07-30
related:
  - "[[skills-templates]]"
  - "[[install-wiring]]"
sources: []
---

# Collapse vendored atlas skills → user-scope pointer

## Decision

Stop vendoring the six memory-atlas skills under `.claude/skills/` in agentic-sage.
They are installed once at user scope; this repo keeps a one-line pointer in
`AGENTS.md` / `CLAUDE.md` and no longer carries skill prose.

## Six copies removed

| skill | vendored hash (first 8) | user-scope hash | relation |
|-------|-------------------------|-----------------|----------|
| atlas-nav | 1e4276d9 | 1e4276d9 | byte-identical |
| atlas-adopt | b59f1e80 | b59f1e80 | byte-identical |
| writing-for-retrieval | 1ebfbfbb | 1ebfbfbb | byte-identical |
| atlas-update | 02174472 | 02174472 | byte-identical |
| atlas-seed | 4e2b2726 | 4e2b2726 | byte-identical |
| atlas-recollection | 30a6b023 | 709627d9 | **diverged** (see below) |

Canonical package path: `memory-atlas/skills/<name>/SKILL.md` (npm file list).
User-scope install path: `~/.claude/skills/<name>/SKILL.md` (hashes match canonical).

## atlas-recollection divergence (read before delete)

Vendored `30a6b023` vs user/canonical `709627d9`.

**Canonical has and vendored lacked** (the improvement direction):

- Rebuild/check **role split**: workers update/stamp only touched zones, run
  `atlas check` (read-only), **must not** `atlas build` or stage `map/index.md`
  (index is full-file regen; parallel workers conflict; textual merge is wrong).
- Integrators alone run `atlas build` after merge; re-stamp zones actually re-read.
- Default when unsure: you are a worker.
- Safety net: `atlas wire merge-driver --write` + `docs/recollecting-in-parallel.md`.

**Vendored had and canonical replaced** (stale):

- Single bullet: "`atlas check` — regenerates `map/index.md` and verifies…" then
  commit the index with the code change. That both misstates what `check` does
  and fights multi-worker recollection.

**Verdict:** vendored was older/worse, not a unique improvement. Safe to delete
without folding prose back into memory-atlas. No human fold-back required for this
repo's copy.

(Other fleets: mossferry/work-kb had writing-for-retrieval at `8c44453b` — out of
scope here; this repo matched canonical.)

## Lockfile / tooling

- Pruned `skills/*` keys from `.atlas-state.json` via `memory-atlas` `writeState`
  (not hand-shaped). On-ramp block hashes left unchanged.
- `atlas-seed` was never claimed in the lockfile even when present on disk.

## Known transitional issue

Installed atlas **0.5.3** may print an update nudge pointing at
`.claude/skills/atlas-update/SKILL.md`. After this collapse that path is gone
until a newer memory-atlas release rewrites the nudge to user-scope (or the skill
name only). Do **not** keep a stub skill to paper over it. Fix version: whatever
ships the path-free nudge after 0.5.3 (registry already shows 0.5.4 available;
confirm nudge text on bump).

## Why

Cross-repo skill copies drifted with no A-vs-B detector. User scope is current;
repo copies could only get more stale. Gate no longer requires vendored copies
(atlas 0.5.3: delete does not break `atlas gate`).
