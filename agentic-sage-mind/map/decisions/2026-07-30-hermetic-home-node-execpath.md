---
type: decision
summary: "Suite spawns under a hermetic HOME must use process.execPath (via test/helpers NODE), never bare PATH node — desk nvm shims resolve $HOME/.nvm and exit 127 in temp homes; NVM_DIR hardcoding is not OSS-portable (same trap as mossferry)."
status: accepted
created: 2026-07-30
updated: 2026-07-30
related:
  - "[[cli]]"
  - "[[emitter]]"
  - "[[session-store]]"
  - "[[install-wiring]]"
sources: []
---

# Hermetic HOME + interpreter resolution

## Context

CLI and emitter tests correctly set a temp `$HOME` so they never touch the human's real sage state. On some desks, `node` on PATH is a shim that resolves the real interpreter from `$NVM_DIR` / `$HOME/.nvm` and deliberately refuses system node. With a hermetic HOME and no nvm tree there, every `execFileSync('node', …)` child exits **127** with `no nvm Node ≥24` before product code runs — ~100 suite failures that look like product bugs.

Exporting `NVM_DIR` to the developer's real nvm path would green this machine only and break clones without nvm.

## Decision

1. **`test/helpers.mjs` exports `NODE = process.execPath`** and `hermeticEnv(home, extra)` for the sandbox env.
2. **All suite subprocesses** that run SAGE scripts use `NODE` (or `process.execPath`) as the executable — never bare `"node"`.
3. **Do not** hardcode nvm paths or set `NVM_DIR` to the developer's real home in shared helpers.
4. **Optional:** a test that *must* exercise a PATH shim may set real `NVM_DIR` and **skip** cleanly when v24 is absent — only that subject, not the whole suite.

## Consequences

- Portable across nvm desks, plain system Node, and CI.
- Hermetic HOME stays mandatory.
- Product self-spawns already prefer `process.execPath` (`lib/judge-run.mjs`, `lib/wiring.mjs`); bare-name re-invoke is not the CLI default.
- Cross-repo lesson (mossferry hit this twice): hermetic HOME + PATH language shims = always pin `process.execPath` in test spawn helpers.

## Anchors

- `test/helpers.mjs` — `NODE`, `hermeticEnv`, `runNode`
- Call sites: `test/cli.test.mjs`, `test/emit.test.mjs`, `test/war.test.mjs`, `test/install.test.mjs`, `test/store.test.mjs`, `test/board-watch.test.mjs`, `test/war-watch.test.mjs`
