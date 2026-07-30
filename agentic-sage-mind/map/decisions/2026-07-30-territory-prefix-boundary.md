---
type: decision
summary: "Both-glob territory overlaps require path-segment prefix compatibility so nested/** does not false-overlap nested-inner/** (nested worktree names)."
status: accepted
created: 2026-07-30
updated: 2026-07-30
related:
  - "[[judge-surface]]"
sources: []
---

# Path-boundary static prefix for both-glob overlaps

## Context

Adversarial survivor #16: `overlaps` for two globs used `staticPrefix(a).startsWith(staticPrefix(b))` (either way). That makes `nested/**` overlap `nested-inner/**` because the string `"nested-inner"` starts with `"nested"`. Nested git worktrees commonly use sibling directory names with a shared prefix, so territory and merge-brief reported false contested paths.

## Decision

For both-glob pairs, static prefixes are compatible only when equal, either is empty (vacuous, e.g. `*.ts`), or the longer continues with `/` immediately after the shorter (true path-child relationship). Suffix discrimination for empty-prefix globs is unchanged.

## Consequences

- `nested/**` vs `nested-inner/**` → no overlap.
- `src/**` vs `src/foo/**` → still overlaps.
- Covered by `test/territory.test.mjs` overlaps cases.
