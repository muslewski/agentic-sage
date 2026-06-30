# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- release-please will maintain this file after v0.1.0 is published -->

## [Unreleased]

## [0.1.0] — 2026-06-30

### Added

- `sage` CLI: `board`, `fleet`, `territory`, `why-diverged`, `merge-brief`, `repos`,
  `on`, `off`, `link`, `unlink`, `claim`, `backlog`, `guard`, `adapter`, `doctor`,
  `statusline`, `init`
- Conservative `install.mjs` / `sage init`: seeds disabled config, symlinks emitter
  hook, merges `settings.json` lifecycle hooks, wires tmux bind, symlinks skills
- `sage-fleet` skill: session coordination protocol (territory, claim, merge-brief,
  why-diverged)
- `sage-doctor` skill: one-command config-validity check
- Guard (default OFF): blocks contested-path edits via `PreToolUse` hook (`exit 2`)
- Adapter system: per-project `backlogRows` / `zones` via `.sage/adapter.mjs`
- Statusline segment: ephemeral "Asking Sage" indicator while a consult verb runs
- 165 hermetic tests (node:test)

[Unreleased]: https://github.com/muslewski/agentic-sage/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/muslewski/agentic-sage/releases/tag/v0.1.0
