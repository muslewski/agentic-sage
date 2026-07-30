---
type: decision
summary: "sage doctor reports fragile user-scope wiring (dangling / worktree / nvm / wired-missing) but never repairs ~/.claude — human decides; a mutating doctor is worse than the bug."
status: accepted
created: 2026-07-30
updated: 2026-07-30
related:
  - "[[judge-surface]]"
  - "[[install-wiring]]"
sources: []
---

# Doctor reports, does not repair user-scope wiring

## Context

Real incident: `~/.claude/hooks/agentic-sage-emit.mjs` was a symlink into a git
worktree. Worktree cleanup dangled the link; every Stop hook failed with
`MODULE_NOT_FOUND`. A second legacy link pointed into an nvm-pinned
`node_modules` path. Nothing warned anyone until stack traces filled the
terminal. Fleet parallel work creates and destroys worktrees constantly, so
this class of failure is about to get more common.

## Decision

1. **`sage doctor` detects** four conditions under `$HOME/.claude` (hooks,
   skills, `settings.json` commands): dangling symlink, worktree-targeted path,
   nvm-pinned path, wired-but-missing command path.
2. **Doctor never mutates user config.** No auto-relink, no delete, no rewrite
   of `settings.json`. Report the offending path and a concrete fix; the human
   (or an explicit `sage init --repair` they chose) acts.
3. **Severity is honest:** broken-now (dangling, wired-missing) uses ✗; latent
   risk that still resolves (worktree, nvm-pinned) uses ⚠. Do not print both for
   the same path.
4. **Fail-open:** missing `~/.claude`, unreadable files, malformed JSON → one
   line and continue. Never throw into doctor; never change exit behaviour of
   unrelated checks (doctor stays exit 0).
5. **Install prevention:** `wireAll` / `wireProject` call `stabilizePackageRoot`
   so new installs from a worktree checkout emit main-root targets. Prevention
   does not auto-heal existing bad links.

## Consequences

- Doctor can surface a red/amber desk without surprising side effects on
  `~/.claude` mid-session.
- Humans keep ownership of agent harness config (foreign hooks stay untouched).
- Tests use hermetic `$HOME` only — never the developer’s real home.
- Recollection and docs must keep the “report ≠ repair” distinction visible.

## Anchors

- `lib/user-scope-wiring.mjs` — `inspectUserScopeWiring`, `userScopeWiringChecks`, `stabilizePackageRoot`
- `lib/control.mjs` — doctor integration + ⚠ render
- `lib/wiring.mjs` — stabilize on wire
- `test/user-scope-wiring.test.mjs`
- `docs/reference/troubleshooting.md` — user-scope wiring catalogue
