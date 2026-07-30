---
type: zone
summary: "Install and teardown — wiring/init/harness, wire stamps state.wiredVersion, stabilize package root away from worktrees, fleet-wire scripts, verify-fleet, uninstall."
tags: [install, wiring, init, fleet]
status: active
created: 2026-07-21
updated: 2026-07-30
verifiedAt: 01de612d
owns:
  routes: []
  testids: []
  globs:
    - "install.mjs"
    - "uninstall/**"
    - "lib/wiring.mjs"
    - "lib/init.mjs"
    - "lib/harness.mjs"
    - "lib/install-state.mjs"
    - "lib/user-scope-wiring.mjs"
    - "scripts/**"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

How SAGE attaches to a machine or repo: symlink emitter, merge seven lifecycle hooks into Claude settings (backup once, skip-if-present, abort on malformed JSON), optional Grok hook file, skill symlinks, tmux `bind j` popup, interactive/non-interactive init (scope × storage × enable), repair/rename of legacy `~/.claude/sage`, and reversible uninstall. Successful `wireAll`/`wireProject` stamps `~/.claude/agentic-sage/state.json` `wiredVersion` for package-freshness Tier A. **Package-root stabilize (2026-07-30):** before linking, `stabilizePackageRoot` prefers the main git checkout when `repoRoot` is a linked worktree — so `sage init` from a worktree never points `~/.claude/hooks/*` at a path `git worktree remove` will delete. Fleet helpers: `scripts/fleet-wire-preferred-judge.mjs`, `scripts/fleet-drop-atlas-adapter.mjs`, `scripts/desk-gate.mjs`, `scripts/fleet-desk-wire.mjs` (`fleet-wire-desk.mjs` alias).

## Anchors

- `install.mjs` — thin entry (legacy global init)
- `lib/wiring.mjs` / `lib/init.mjs` / `lib/harness.mjs` — real logic
- `uninstall/**` — surgical undo
- `scripts/**` — npm postinstall + fleet verification harness

## Invariants

Prefer empty until verified. Product claims: never auto-enable without `--enable`; never clobber existing config.

## Repair creates per-repo storage (2026-07-30)

`sage init --repair` re-asserts hooks/skills and, when cwd is a git repo under
**global** scope, `mkdir`s the resolved data dir (`explainRepoDataDir` →
`repos/<repo_id>` under sage home). Project-scope repair already did this via
`wireProject`. Doctor’s `storage dir` ✗ with `→ run: sage init --repair` must
clear after that command — an empty dir is enough for ✓. First session write
(`register` / `mergeRecord`) also creates the dir.

## Lineage

AGENTS.md setup runbook, README install section, wiring headers, 2026-07-21 atlas-seed pass.
