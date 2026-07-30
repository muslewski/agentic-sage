---
type: debt
summary: "Adversarial survivor reconcile (21): 19 FIXED on main (+2 this pass), 1 NOT-FIXED deferred (memory-atlas atlas init stub index), 1 NOT-REPRODUCIBLE mis-filed path for atlas init under sage lib/init.mjs."
tags: [survivors, reconcile, containment, territory, gate]
status: open
created: 2026-07-30
updated: 2026-07-30
severity: medium
effort: s
related:
  - "[[judge-surface]]"
  - "[[session-store]]"
  - "[[cli]]"
sources: []
---

# Adversarial survivor reconcile — agentic-sage

Cold check of 21 defects that survived adversarial refutation, against `main`
after the desk-hardening wave (`e783f64`) plus this reconcile branch.

Classification key: **FIXED** | **NOT-FIXED** | **INTENDED** | **NOT-REPRODUCIBLE**.

## Ledger (one row per survivor)

| # | sev | site | STATE | evidence |
|---|-----|------|-------|----------|
| 1 | critical | `bin/sage` register `--sid` | **FIXED** | `isSafeSessionId` + CLI `/[/\\]\|\.\./` + exit 2 (`bin/sage` register case; `lib/store.mjs` `isSafeSessionId`). Test: `test/register.test.mjs` "refuses path-like sids". |
| 2 | critical | `lib/register.mjs` worktree | **FIXED** | `worktree: worktree \|\| cwd` from `resolveRepo` → `resolveWorktreeRoot` (`--show-toplevel`). Test: `test/register.test.mjs` "stores worktree as the cwd checkout"; `test/repo-id.test.mjs` nested worktree distinct path. |
| 3 | critical | `lib/store.mjs` atomicWriteJson symlink | **FIXED** | `assertPathInside` + root option on write/merge (`lib/store.mjs`). Test: `test/store.test.mjs` "sessions/ symlink escape is refused". |
| 4 | critical | `lib/store.mjs` / board FIFO hang | **FIXED** | `readJson` requires `st.isFile()`; `collectSessions` skips non-files (`lib/board.mjs`). Test: `test/store.test.mjs` "readJson skips non-files (FIFO…)" also drives `collectSessions`. |
| 5 | critical | `lib/territory.mjs` mergeBrief claimed | **FIXED** | `mergeBrief` unions claimed + touched (`lib/territory.mjs`). Test: `test/territory.test.mjs` "mergeBrief contests claimed_globs overlaps". |
| 6 | major | `bin/sage` claim error exitCode | **FIXED** | claim case sets `process.exitCode` 1/2 on usage/no-session/unsafe/missing. Tests: `test/cli.test.mjs` claim exit 1/2 cases. |
| 7 | major | `bin/sage` claim always exit 0 | **FIXED** | same as #6 — failed claim status ≠ 0. |
| 8 | major | `bin/sage` claim on closed session | **FIXED** | refuses when `status`/`link_state` closed; exit 1. Test: `test/cli.test.mjs` "claim on a closed session refuses…". |
| 9 | major | `bin/sage` main().catch exitCode | **FIXED** | `.catch` sets `process.exitCode = 1` (`bin/sage` tail). No dedicated EACCES spawn test (host-dependent); contract is explicit in source. |
| 10 | major | `lib/control.mjs` link ghosts | **FIXED** | `linkSession` requires existing plain-object record; throws otherwise. Test: `test/control.test.mjs` "linkSession refuses unknown sid". |
| 11 | major | `lib/git.mjs` nested untracked | **FIXED** | `isNestedGitCheckout` skips `?? nested/` in porcelain. Test: `test/git.test.mjs` "skips nested worktree checkout dirs". |
| 12 | major | `lib/git.mjs` outer false-touch nested | **FIXED** | same guard as #11 (duplicate report of same surface). |
| 13 | major | `lib/init.mjs:265` atlas stub index | **NOT-FIXED** (deferred) | **Not sage product code.** Sage `lib/init.mjs` does not write vaults. Defect is `memory-atlas` `lib/init.mjs:265` (`INDEX_PLACEHOLDER` → `map/index.md` fails `atlas check` until `atlas build`). Shared with memory-atlas; do not patch `node_modules`. **Defer:** bump memory-atlas when upstream ships green-init (effort S upstream). Verified: `node_modules/memory-atlas/lib/init.mjs:265` still writes placeholder. |
| 14 | major | `lib/register.mjs` worktree=main | **FIXED** | duplicate of #2 at lower severity. |
| 15 | major | `lib/repo-id.mjs` relocated gitdir | **FIXED** | if basename(common)≠`.git`, root = common dir realpath (not dirname). Test: `test/repo-id.test.mjs` "relocated gitdir does not use dirname…". |
| 16 | major | `lib/territory.mjs` both-glob prefix | **FIXED** (this pass) | `prefixCompatible` requires `/` path boundary so `nested/**` ↛ `nested-inner/**`. Test: `test/territory.test.mjs` overlaps cases. Reproduced `overlaps('nested/**','nested-inner/**')===true` before fix. |
| 17 | major | `lib/territory.mjs` claimsOf non-array | **FIXED** | `Array.isArray` coerce to `[]`. Test: `test/territory.test.mjs` "claimsOf coerces non-array…". |
| 18 | minor | `bin/sage` claim truthy non-object | **FIXED** | claim requires plain object (`!Array.isArray`). Test: `test/cli.test.mjs` "claim on non-object session record…". |
| 19 | minor | `lib/control.mjs` doctor home file | **FIXED** | `isDir` not bare `existsSync`. Test: `test/control.test.mjs` "doctor sage home: regular file…". |
| 20 | minor | `lib/package-freshness.mjs` home create | **FIXED** (this pass) | registry cache write only if sage home already exists. Test: `test/gate.test.mjs` "gate home-missing does not create…". Reproduced create under `env:{}` + `fetchLatest` before fix. |
| 21 | minor | `lib/store.mjs` readJson FIFO | **FIXED** | same as #4 (`isFile` guard). |

## Deferred (still open)

1. **[major] memory-atlas `atlas init` stub `map/index.md`** — effort **S** (upstream: run `atlas build` at end of init, or write a minimal legal index). Why not here: product code is not in this repo; patching vendored `node_modules` is out of scope and would be wiped on install. Track via memory-atlas reconcile / dependency bump.

## Not claimed INTENDED

No survivor was reclassified as INTENDED. Several look intentional at a glance (fail-open, soft register exits) but the desk-hardening wave already made exit honesty and containment match the coordination contract; survivors that remained were either fixed or deferred with evidence.

## Verification (this pass)

- `npm test` — run on finish (see PROGRESS / RESULT).
- `PATH=/usr/bin:/bin:/usr/local/bin npm test` — run on finish.
- `node_modules/.bin/atlas check` — run on finish (do not stage generated `map/index.md` for advisor rebuild).
