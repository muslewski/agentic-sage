---
type: zone
summary: "Install and teardown — `install.mjs`, `sage init` wizard, conservative settings.json / Grok hook merge (`wiring`), harness profiles, postinstall, verify-fleet script, and surgical `uninstall/`."
tags: [install, wiring, init]
status: seeded
created: 2026-07-21
updated: 2026-07-21
verifiedAt: unverified
owns:
  routes: []
  testids: []
  globs:
    - "install.mjs"
    - "uninstall/**"
    - "lib/wiring.mjs"
    - "lib/init.mjs"
    - "lib/harness.mjs"
    - "scripts/**"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

How SAGE attaches to a machine or repo: symlink emitter, merge seven lifecycle hooks into Claude settings (backup once, skip-if-present, abort on malformed JSON), optional Grok hook file, skill symlinks, tmux `bind j` popup, interactive/non-interactive init (scope × storage × enable), repair/rename of legacy `~/.claude/sage`, and reversible uninstall.

## Anchors

- `install.mjs` — thin entry (legacy global init)
- `lib/wiring.mjs` / `lib/init.mjs` / `lib/harness.mjs` — real logic
- `uninstall/**` — surgical undo
- `scripts/**` — npm postinstall + fleet verification harness

## Invariants

Prefer empty until verified. Product claims: never auto-enable without `--enable`; never clobber existing config.

## Lineage

AGENTS.md setup runbook, README install section, wiring headers, 2026-07-21 atlas-seed pass.
