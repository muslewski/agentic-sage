# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- release-please will maintain this file after v0.1.0 is published -->

## [0.2.1](https://github.com/muslewski/agentic-sage/compare/agentic-sage-v0.2.0...agentic-sage-v0.2.1) (2026-06-30)


### Bug Fixes

* point npm homepage at project site ([#6](https://github.com/muslewski/agentic-sage/issues/6)) ([1f089b2](https://github.com/muslewski/agentic-sage/commit/1f089b2e1e6d39ef257654cb2a175f198d360799))

## [0.2.0](https://github.com/muslewski/agentic-sage/compare/agentic-sage-v0.1.0...agentic-sage-v0.2.0) (2026-06-30)


### Features

* **adapter:** sage adapter init scaffolds .sage/adapter.mjs from a template (P13) ([11bd34d](https://github.com/muslewski/agentic-sage/commit/11bd34d3a68c2466176bb072dbd288c424ae8b80))
* add .claude-plugin/marketplace.json for Claude Code marketplace ([77502c6](https://github.com/muslewski/agentic-sage/commit/77502c648c8d03cba7c529ad5f48e60615593e75))
* add sage init subcommand and postinstall hint ([ac904a8](https://github.com/muslewski/agentic-sage/commit/ac904a89f747063d37f8af2a15217ed2b8f00d73))
* **backlog:** core status engine — holders/orphan/glyph-drift (P11) ([ae33d9f](https://github.com/muslewski/agentic-sage/commit/ae33d9ffb4db92531ca7a45e2913c310f7950119))
* **backlog:** sage backlog + sage backlog claim verbs (P11) ([16cb1a0](https://github.com/muslewski/agentic-sage/commit/16cb1a016582f791265d3c740b3ba3dbfa61b88e))
* **backlog:** syndcast adapter backlogRows — parse A/B/C + D table (P11) ([8fac704](https://github.com/muslewski/agentic-sage/commit/8fac7042ea8780c266240c788fd7162eb704d245))
* **board:** branch-led balanced layout (matches the website demo) ([e88e99d](https://github.com/muslewski/agentic-sage/commit/e88e99d9ad9bdea184767e749f8c791d34b22ba7))
* **board:** live sage board --watch with a spinner on working sessions ([02046cf](https://github.com/muslewski/agentic-sage/commit/02046cfa919bbee9e8f1b06bda68a17504feefe7))
* **cli:** colorize sage output (TTY-gated ANSI) ([5c5d150](https://github.com/muslewski/agentic-sage/commit/5c5d1502721f694daa0de564842e8186c1a1b143))
* **doctor:** project-adapter check (present/none — none is healthy) (P13) ([0690e83](https://github.com/muslewski/agentic-sage/commit/0690e83b003713dac907624f49598a19c057b155))
* **doctor:** skills-linked check + verdict summary (P12) ([4ebefbf](https://github.com/muslewski/agentic-sage/commit/4ebefbfab343e261b21a180e351ca881628f36d4))
* **install:** symlink every skills/* dir + /sage-doctor verify pointer (P12) ([4b8f113](https://github.com/muslewski/agentic-sage/commit/4b8f113682cd72102467ead5d4ec2937663f5908))
* P1 core libs — paths, repo-id (worktree→same id), default-OFF enable gate, atomic store, git signals, liveness, registry ([72e7e66](https://github.com/muslewski/agentic-sage/commit/72e7e66274433577c2b7f63153e0f0941ae49f56))
* P1 emitter + installer — fail-open, default-OFF, non-clobbering wire ([e2e6a9b](https://github.com/muslewski/agentic-sage/commit/e2e6a9b7cda7f3792b9eda6b42f2dcd8cab0e07a))
* **P10:** lib/asking — per-session asking breadcrumb primitive ([b38a818](https://github.com/muslewski/agentic-sage/commit/b38a8182bbccb26b08d2cde4bbd8b2f861e9cc45))
* **P10:** sage statusline verb + consult verbs stamp the asking breadcrumb ([f7bd5d2](https://github.com/muslewski/agentic-sage/commit/f7bd5d2ab2ef6a47b164ae4e9c3756047c08fe97))
* **P2:** export branchOf from git lib ([e557d34](https://github.com/muslewski/agentic-sage/commit/e557d3427652c865f6cf12464c317a71c3b163c7))
* **P2:** handoff sidecar lib — schema, write/read, latestSidecar, autoDump ([b0919ba](https://github.com/muslewski/agentic-sage/commit/b0919ba385841e2db0ba430bc61c4615c710c7e5))
* **P2:** PreCompact auto-dump — write sidecar, stamp record (fail-open) ([f9034ee](https://github.com/muslewski/agentic-sage/commit/f9034ee4eac120e815f2114aa6630e784ae8d6a6))
* **P3:** bin/sage CLI dispatch — board/repos/on/off/link/unlink/doctor ([6c72301](https://github.com/muslewski/agentic-sage/commit/6c7230169cc65300fce99503ea9b36a67b707e58))
* **P3:** board reader — collectSessions + liveness/handoff render ([f6db6f1](https://github.com/muslewski/agentic-sage/commit/f6db6f170dde77553fe2636983cd9beb3298f95d))
* **P3:** control lib — on/off, link/unlink, repos, doctor ([adb3efb](https://github.com/muslewski/agentic-sage/commit/adb3efbaf2559a4c69e5add687e2362a1622538c))
* **P4:** bin/sage territory/why-diverged/merge-brief dispatch ([8c8540a](https://github.com/muslewski/agentic-sage/commit/8c8540a3fa9d501a2df652385eda513b3772cf9b))
* **P4:** crossStat — cross-branch numstat drill-down (tier 2), defensive ([a03de1a](https://github.com/muslewski/agentic-sage/commit/a03de1ac903f6e401671e016da0426a01d0009ee))
* **P4:** territory lib — glob matcher, generated heuristic, builders + renders ([bdb026e](https://github.com/muslewski/agentic-sage/commit/bdb026efc788687e97cfdb62793b1ceae7881053))
* **P5:** adapter loader + enrichment seam (fail-closed-to-core) ([a355867](https://github.com/muslewski/agentic-sage/commit/a355867f5b1f75752643615c34d4200515310699))
* **P5:** syndcast adapter — zone/backlog/generated parsers (zero-dep) ([4478212](https://github.com/muslewski/agentic-sage/commit/4478212c2f7a9521cbd6f2e5ceb392eefe7cc4a3))
* **P5:** wire adapter enrichment into board/territory/conflict ([22d14ec](https://github.com/muslewski/agentic-sage/commit/22d14ec3e76ca4d51aedb2bbf92000764afbc559))
* **P6:** install.mjs — idempotent tmux bind j + session-sync fleet-line doc ([848d220](https://github.com/muslewski/agentic-sage/commit/848d220aabc3eec15fbe116dff53c96cc440371b))
* **P6:** lib/fleet — one-line nearest-neighbour fleet summary (pure) ([5b24e3f](https://github.com/muslewski/agentic-sage/commit/5b24e3ff052e83202e73fa2dc78cc7973871d805))
* **P6:** lib/tmux — pane parser + bounded pid→pane /proc walk (defensive) ([88a7ec0](https://github.com/muslewski/agentic-sage/commit/88a7ec09e862185074ec3cd432ec6b21d9eff02f))
* **P6:** sage fleet command + optional board tmux pane column ([963ec4e](https://github.com/muslewski/agentic-sage/commit/963ec4eb92a7dc84e7733cbefbbff866b53d2d57))
* **P6:** SessionStart fleet brief — gated, fail-open, SessionStart-only ([926a267](https://github.com/muslewski/agentic-sage/commit/926a267e81bc490351186420d7f444daece34ce9))
* **P7:** emit PreToolUse guard — gated, fail-open, exit 2 only on verified block ([3e1ae26](https://github.com/muslewski/agentic-sage/commit/3e1ae26f11f5e003dcd07882448f95888f9dd342))
* **P7:** install wires PreToolUse (guard, default-OFF) ([2977810](https://github.com/muslewski/agentic-sage/commit/297781029f141a3c760ef68f62018ded429579b5))
* **P7:** lib/guard — PreToolUse match + atomic curation (default-OFF) ([9b0b4fb](https://github.com/muslewski/agentic-sage/commit/9b0b4fb7b0238943e4d120bded99702c695f2afc))
* **P7:** lib/self — resolve current session via env or pid-walk ([5bb8899](https://github.com/muslewski/agentic-sage/commit/5bb88994ce5812369164bc67dcbecddfc80ebdd9))
* **P7:** sage guard + sage claim commands ([92fc557](https://github.com/muslewski/agentic-sage/commit/92fc5570bb408b09a46922e0d62400fbf76168b5))
* **P8:** token-forecast doctor check is config-driven (portable) ([5bca519](https://github.com/muslewski/agentic-sage/commit/5bca5199dc1f21a23eaa1b17ceb37100ad47aa65))
* **P9:** install.mjs symlinks the sage-fleet skill (non-clobbering, opt-out) ([5736e21](https://github.com/muslewski/agentic-sage/commit/5736e21e542a816ff92118267b4c5e109ab43b8e))
* **P9:** the sage-fleet session-coordination skill + artifact test ([a7719e6](https://github.com/muslewski/agentic-sage/commit/a7719e6573798782c1fa742eb2a75527ac846ae1))
* **skill:** /sage-doctor user-invocable config check (P12) ([5f98700](https://github.com/muslewski/agentic-sage/commit/5f987009ea6fd611f5aa61764f54866ef36948d7))
* **uninstall:** surgical reversible uninstall — wiring only, state kept, foreign config untouched (P13) ([b56fece](https://github.com/muslewski/agentic-sage/commit/b56fece0531119fc039c7ae629278adc5d5b17e2))


### Bug Fixes

* **backlog:** strict row-id guard on `backlog claim` (P11 review 🟡) ([8df9e8f](https://github.com/muslewski/agentic-sage/commit/8df9e8ff575c397e331ba70c1ff44dd9dd688e70))
* **P10:** wrap claim's markAsking best-effort (review 🟡) ([a111e7b](https://github.com/muslewski/agentic-sage/commit/a111e7bc9d913037f0c877a49cb121e3c831c805))
* **P1:** adversarial-review fixes ([b62b713](https://github.com/muslewski/agentic-sage/commit/b62b713428030f604b027df1669c177627404209))
* **P4:** overlaps — suffix-discriminate empty-prefix globs ([b4ed59c](https://github.com/muslewski/agentic-sage/commit/b4ed59c8b9c880b9cebe421770aa9fdc088c9c7f))
* **P5:** claimedWork — scope branch match to the Lands column (review) ([5021899](https://github.com/muslewski/agentic-sage/commit/50218994c16b496f8ac3c730144af479dcdade66))
* **P5:** claimedWork status — match standalone glyph cell, not includes ([2d0075b](https://github.com/muslewski/agentic-sage/commit/2d0075be7e45f2ebfd7ad9a6e5ec1a9dc6fccbf4))
* **P7:** glob matcher treats [ ] { } as literal — no wrong guard blocks (review HIGH) ([616058c](https://github.com/muslewski/agentic-sage/commit/616058cbb0857c00b82b1f6fbaf630cd1402a9dd))
* **P7:** harden guard + claim per adversarial review ([f0bfd55](https://github.com/muslewski/agentic-sage/commit/f0bfd55432ee0930f5e973ca87195dd28e3b9487))
* **P9:** skill backup never clobbers an existing .bak (review 🟡) ([9cabf8b](https://github.com/muslewski/agentic-sage/commit/9cabf8b77bafce415fd5e7fbe8a04b24c588a75a))
* **uninstall:** exact-signature matching (skeptic 🟡×3) + ADAPTERS five-fn count (review 🔴) (P13) ([a771b6d](https://github.com/muslewski/agentic-sage/commit/a771b6db2ca17af31831ada92213577382f11ff6))

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
