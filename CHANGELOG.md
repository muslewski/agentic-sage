# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- release-please will maintain this file after v0.1.0 is published -->

## [1.2.0](https://github.com/muslewski/agentic-sage/compare/agentic-sage-v1.1.0...agentic-sage-v1.2.0) (2026-07-23)


### Features

* live judge continuous briefs (v1.2.0) ([ad94666](https://github.com/muslewski/agentic-sage/commit/ad94666f84566f51d4a3218c14ba2b85a184d97c))
* sage judge run + war ⚖ chrome for live judges ([b5f2e7a](https://github.com/muslewski/agentic-sage/commit/b5f2e7a3970b8ca1eb55f44794fe8bb9b7bf34f9))

## [1.2.0](https://github.com/muslewski/agentic-sage/compare/agentic-sage-v1.1.1...agentic-sage-v1.2.0) (2026-07-23)

### Features

* **judge:** optional live judge sessions publish continuous store-native briefs (`sage judge on/off/status/show/publish`)
* **judge:** `sage judge run` — easy start with auto scope (fleet vs repo), harness auto (grok→claude→none), `--once` / `--print-only`
* **judge:** fact-only keeper via `--harness none` (no LLM required)
* **brief:** worker consult verbs layer fresh repo + fleet briefs after deterministic facts (`--no-brief` to skip)
* **brief:** 30s post-exit **grace** window so burst publishes still attach when the judge process is gone; `· grace` chip in render
* **collision:** sessions with `role=judge` excluded from territory / merge-brief / HEAT peers
* **war:** header **⚖** chip + FLEET panel judge line when live/grace briefs or judge sessions
* **skill:** `sage-judge` skill loop; `sage-fleet` notes brief authority vs CLI facts
* **schema:** `sage.brief`, session `role`/`judge_scope`, fleet/war `briefs` + `totals.judges`

### Docs

* recipe [Live judge](docs/recipes/live-judge.md); CLI + fleet-judge concept updates

## [1.1.0](https://github.com/muslewski/agentic-sage/compare/agentic-sage-v1.0.0...agentic-sage-v1.1.0) (2026-07-20)


### Features

* **board:** live-first roster, archive fold, ctx gauges ([a1d0adc](https://github.com/muslewski/agentic-sage/commit/a1d0adccf5961c0878681ace1bc3a3d11d014717))
* **cli:** board --all + optional fzf jump on TTY ([81597a7](https://github.com/muslewski/agentic-sage/commit/81597a7b64f0da7339001ea1931abc5a77bc6bc5))
* **cli:** enable SGR mouse in sage war and board --watch ([55c35dc](https://github.com/muslewski/agentic-sage/commit/55c35dce9bee9f34043b5a14f2443666dc180e53))
* **cli:** sage board --json versioned envelope ([9268c53](https://github.com/muslewski/agentic-sage/commit/9268c53ec845d63a0f21f991fbf4504b53ca79c6))
* **cli:** sage fleet --json envelope ([984a895](https://github.com/muslewski/agentic-sage/commit/984a89564d76600d8c089bd01c2d583a52725f75))
* **cli:** sage prune — drop old closed/dead sessions ([0a623e3](https://github.com/muslewski/agentic-sage/commit/0a623e38a1031de607df487c3a58d6d6c3f5002e))
* **cli:** sage war — static cockpit + --json envelope + board hint ([2d2d2e3](https://github.com/muslewski/agentic-sage/commit/2d2d2e36243dccac4a26695208abcb08f932a758))
* **cli:** sage war live cockpit — raw-mode keys + scroll ([fda4a0b](https://github.com/muslewski/agentic-sage/commit/fda4a0b1388ab45c84110227187286554596e69b))
* **cli:** sage war war-room cockpit (round 4, plan 018) ([ed50e27](https://github.com/muslewski/agentic-sage/commit/ed50e27765d4f531afeb0441c65de368bdf85f14))
* **color:** semantic state→style paint; help stays uncolored ([f6a9985](https://github.com/muslewski/agentic-sage/commit/f6a99853e4257e327c18da8785d8434034de76c4))
* **doctor:** grok wiring check with remedy ([516e9f8](https://github.com/muslewski/agentic-sage/commit/516e9f80debc9b55e249a50405160dd843ff308c))
* **doctor:** health banner + gauge; every failure gets a fix hint ([899d794](https://github.com/muslewski/agentic-sage/commit/899d79443b89087b676cc586f2d47aa6a6b78f61))
* **emit:** capture pid_start at SessionStart ([c1dcaea](https://github.com/muslewski/agentic-sage/commit/c1dcaea54115c6d10d78d14c471c757065760cbf))
* **emit:** capture ppid pid + provenance + tmux window name at SessionStart ([695c3d4](https://github.com/muslewski/agentic-sage/commit/695c3d4e5eecee4a740bd1b8633acece0ec5f2fd))
* **fleet:** classify human vs nested; split totals via pure tally ([627d026](https://github.com/muslewski/agentic-sage/commit/627d026909be02e0f6310fcf7d2f272bf5452ef7))
* **fleet:** collectFleet/filterFleet/sortFleet cross-repo roll-up ([67a76fa](https://github.com/muslewski/agentic-sage/commit/67a76fac7fbcd8c0118bd40219fd066e45231522))
* **grok:** grok-compat pass — emitter event map, snippets, docs ([eb8dfb8](https://github.com/muslewski/agentic-sage/commit/eb8dfb87c4c457255e645022a2d5da2ff28c0233))
* **init:** --harness both wires claude and grok ([3b6b89d](https://github.com/muslewski/agentic-sage/commit/3b6b89dfe29be1e60ce513f3c0c0a65ffd2f04cd))
* land interop-026 compacting face + Phase 0/1 contract work ([3ce7a04](https://github.com/muslewski/agentic-sage/commit/3ce7a04e98278e8a8e63e12b88c01b3d5f1e3236))
* live-first fleet truth — contested, panels, ghost collapse ([4602f79](https://github.com/muslewski/agentic-sage/commit/4602f795cf557b235988c3b4e418cbed82920598))
* **liveness:** recycle-proof isAlive via start-time match ([20beca7](https://github.com/muslewski/agentic-sage/commit/20beca727bb5d5d806af23275150193e463a3eac))
* **merge-brief:** risk chip, heat sparkline, TTY fzf path drill-in ([6f7588e](https://github.com/muslewski/agentic-sage/commit/6f7588e731b33900bed5ca11113073de74394fc5))
* **mouse:** pure SGR parseMouseEvents helper + unit tests ([4dbbeda](https://github.com/muslewski/agentic-sage/commit/4dbbeda5b16c801e2a9f907f668a913cfe4cee5a))
* **provenance:** classify human vs nested by launcher tag + process tree ([fd27f93](https://github.com/muslewski/agentic-sage/commit/fd27f93b90a5a90840f39ef9c30167cb05985e47))
* **repos,fleet:** product/orphan atlas + composable HUD segments ([11b0a4a](https://github.com/muslewski/agentic-sage/commit/11b0a4a0c17b7d8e05633bd971058cbfd6c177ba))
* **scripts:** sandboxed verify-fleet end-to-end checker ([d2243db](https://github.com/muslewski/agentic-sage/commit/d2243db2b79fc8742889ab6d1e4274f6ae3f45f7))
* **tmux:** add commOf/cmdlineOf/windowNameForPane readers ([0a74423](https://github.com/muslewski/agentic-sage/commit/0a7442315cf4a3b8137c974869b810f2b78a10b0))
* **tmux:** add startTimeOf/parseStartTime /proc reader ([1f77575](https://github.com/muslewski/agentic-sage/commit/1f77575f3770d1ac00822ae4008b1b4bd859e24f))
* **war:** ? help overlay with full key map ([2f17682](https://github.com/muslewski/agentic-sage/commit/2f17682e3a16d9be1dd6709f6fb7099b4a22cfc8))
* **war:** / filter + w working-only over the fleet body ([fdf6c22](https://github.com/muslewski/agentic-sage/commit/fdf6c2241eca324200b8c3c3a556a7e941c6a441))
* **war:** color face tabs and footer for contrast ([74a8532](https://github.com/muslewski/agentic-sage/commit/74a85327a1e873bc76f9f8066925cd05d9646698))
* **war:** cream column-header labels ([aeeeeb8](https://github.com/muslewski/agentic-sage/commit/aeeeeb87a6913851b5a46f280ffdaa894d4a6722))
* **war:** Layer B nested rollup — fold armory children by default (plan 024) ([82702ff](https://github.com/muslewski/agentic-sage/commit/82702ffe0b5c8c75e097f785ce2af8d47a462d02))
* **war:** LIVE · CLASH · MEMORY faces (←→ tabs) ([018d565](https://github.com/muslewski/agentic-sage/commit/018d5654986f02a9f1bcbe2945012b998426e150))
* **war:** make faces more useful — counts, smarter CLASH, MEMORY feedback ([13b913a](https://github.com/muslewski/agentic-sage/commit/13b913a46e50a15be437f5b071423ee670c9f978))
* **war:** manage mode — kill dead sessions from the cockpit ([2876db4](https://github.com/muslewski/agentic-sage/commit/2876db4afa8131737b82d8b09104c592d1812b58))
* **war:** manage-mode footer menu + confirm + nav hint ([d7927b8](https://github.com/muslewski/agentic-sage/commit/d7927b82abec40f88f7f30b99b8f3da52142bb90))
* **war:** NAME | BRANCH grid — fill the gap, calm repo bands ([8a48de0](https://github.com/muslewski/agentic-sage/commit/8a48de0fae2dc57ef8647dcb0d6d053d381e5619))
* **war:** name-first layout, zone toggle, labeled footer ([1afbbb7](https://github.com/muslewski/agentic-sage/commit/1afbbb74c75198d124ad79fcee3746137d23afef))
* **war:** nav X clears dead; fixed-width grid stops layout jitter ([94a3742](https://github.com/muslewski/agentic-sage/commit/94a37424d6dbac9d1b0f24f864fbdd88d50718fd))
* **warnav:** isKillable + collectDead for dead-session removal ([7ddbb5b](https://github.com/muslewski/agentic-sage/commit/7ddbb5b701dc02ac9fe3db5b0ffacc53826ed495))
* **warnav:** selection engine + body-model session handle ([c08123f](https://github.com/muslewski/agentic-sage/commit/c08123f5a11fde6965ed5eb17bd6ee3e239bbb29))
* **warroom:** cockpit renderers — panels, body, viewport, spinner ([09768e7](https://github.com/muslewski/agentic-sage/commit/09768e7f97c2d20ab433ec2d521f11516906fa2b))
* **warroom:** cursor viewport + selection marker, skinned ([7dff508](https://github.com/muslewski/agentic-sage/commit/7dff508071c35d26551913b190cb5c393624ef5b))
* **warroom:** repo header band with accent bar + hot rollup ([b1f8206](https://github.com/muslewski/agentic-sage/commit/b1f8206bf00c8664618675eb362e80fac024306c))
* **warroom:** sticky repo band while scrolling ([7b7d8b5](https://github.com/muslewski/agentic-sage/commit/7b7d8b515913e03303208616b5c8cee3dea5c904))
* **war:** ruled columns + fixed column-header row ([01879a5](https://github.com/muslewski/agentic-sage/commit/01879a5ebb81f99abfdd0e28d41a8806f5079d0e))
* **war:** select rows + Enter to jump to the session's tmux pane ([1897f00](https://github.com/muslewski/agentic-sage/commit/1897f0039890db0877f1d5c2da2a3665ebcf3aab))
* **war:** show tmux window_name · branch in session rows ([a204cc8](https://github.com/muslewski/agentic-sage/commit/a204cc8be46868a0ba0e3610023db2991ba46886))
* **war:** show ZONE column by default ([168bb9a](https://github.com/muslewski/agentic-sage/commit/168bb9aaddd73713b44bfedace20be093810daf9))
* **wiring:** native grok hook file in wireAll ([4ed6575](https://github.com/muslewski/agentic-sage/commit/4ed6575d278b518273e16eb932b76c0e460d09ea))


### Bug Fixes

* **board:** backfill session_id from filename in collectSessions ([56a5406](https://github.com/muslewski/agentic-sage/commit/56a540626c3942c95b4ac6f41af524ab3a834f20))
* **board:** enforce pid start-time at read (recycle → dead) ([b9aa2ae](https://github.com/muslewski/agentic-sage/commit/b9aa2ae3111848f5a6e26d3059510644b3225afb))
* **board:** pid-less record reads dead, not alive (honest liveness) ([6f791e9](https://github.com/muslewski/agentic-sage/commit/6f791e944f223e05b99f113501d8ed4ef47d6d8b))
* **emit:** stamp session_id on every event, not just SessionStart ([707544b](https://github.com/muslewski/agentic-sage/commit/707544b9475f396e40a9996dc4f05c12a090bce0))
* Grok 4.5 quality-revise — war UX, manage delete, sid safety ([e434096](https://github.com/muslewski/agentic-sage/commit/e4340964a22d2d9fe94bf916b9d2860cac8c67ea))
* Grok 4.5 quality-revise wave 2 — docs truth + legacy migration traps ([d80b608](https://github.com/muslewski/agentic-sage/commit/d80b60848dfeb1d99b9f1efb19a25572f19d277c))
* **provenance:** skip the session's own agent in the tree walk ([0217b91](https://github.com/muslewski/agentic-sage/commit/0217b9148cdcdde7524c6c0e781e6286bc1bca7d))
* **war:** keep q as a filter char; only Ctrl-C quits mid-filter ([32f22e5](https://github.com/muslewski/agentic-sage/commit/32f22e5528802b1a06d29dcf7e2365c7b343ccbd))
* **warroom:** flicker-free repaint, aligned rounded panels, skinned chrome ([2956eca](https://github.com/muslewski/agentic-sage/commit/2956eca7e1ff7906c4441f0e6fb6b1516018ad89))
* **warroom:** rigid session grid, middle-ellipsis long names ([b6baa63](https://github.com/muslewski/agentic-sage/commit/b6baa63583e2bcee63e5ce762dabe4e11fed266f))
* **war:** scale cockpit for 2k+ session fleets (lag + reorder) ([c97a2db](https://github.com/muslewski/agentic-sage/commit/c97a2db8f59dbbd2de95bc784d43cd72fb4da70b))
* **war:** stop wrap/flicker/lag; make X clear dead reliable ([e08f3db](https://github.com/muslewski/agentic-sage/commit/e08f3dbc9272048fd11dc1b4d342b2df18a08365))
* **war:** zone column keeps path tail via left-ellipsis ([8716c77](https://github.com/muslewski/agentic-sage/commit/8716c777d11ab395add42194860815fbb95b4b43))
* **wiring:** dedup hooks by link path, not full command ([7610b8d](https://github.com/muslewski/agentic-sage/commit/7610b8d5be23e23627ed3d13839696056d43002e))


### Performance Improvements

* **sage:** decouple board --watch data refresh from paint clock ([0e9cb5b](https://github.com/muslewski/agentic-sage/commit/0e9cb5bc62b8d796d99263e89c91a043ba883046))

## [1.0.0](https://github.com/muslewski/agentic-sage/compare/agentic-sage-v0.2.1...agentic-sage-v1.0.0) (2026-07-02)


### ⚠ BREAKING CHANGES

* **roots:** the built-in storage root moves from ~/.claude/sage to ~/.claude/agentic-sage and the hook file from sage-emit.mjs to agentic-sage-emit.mjs. Existing installs are unaffected until they run `sage init` (or `init --repair`), which migrates in place; reads keep working via the legacy fallback in the meantime.

### Features

* **cli:** wire sage init to lib/init.mjs; add sage where, enable, disable ([0413fe8](https://github.com/muslewski/agentic-sage/commit/0413fe8d6b39a4b85e033ce56c0f4393e0e24b90))
* **doctor:** remedy lines + repos aggregation across the registry ([c87a206](https://github.com/muslewski/agentic-sage/commit/c87a206b9187e37700b520406dfcfbd451c37465))
* **enabled:** scope-aware gate — project installs ignore the global master ([5177891](https://github.com/muslewski/agentic-sage/commit/51778916f45a5e375e7802860c2c2229ede991da))
* **init:** non-interactive flags, TTY wizard, and the clean 4-line summary ([c292cad](https://github.com/muslewski/agentic-sage/commit/c292cad1d3faf2e29a6bb70faed40a2998f23835))
* **roots:** rename on-disk state to agentic-sage, with read-only legacy fallback ([284aa4e](https://github.com/muslewski/agentic-sage/commit/284aa4e5faf4a5edc9e72c5122e99f1099fb5648))
* **roots:** storage-root resolver + harness profile table ([8b2730f](https://github.com/muslewski/agentic-sage/commit/8b2730fee160870a6763308a253051a1c4d77bdd))
* **wiring:** project-scope install — marker, registry, project settings.json ([f202ea3](https://github.com/muslewski/agentic-sage/commit/f202ea339f55ddfc86ca9fa5d4b613025d16132e))


### Bug Fixes

* **cli:** read verbs resolve self via pid-walk, not env-only — a session no longer collides with itself ([582dcaa](https://github.com/muslewski/agentic-sage/commit/582dcaa7e5ceed922e0cc99d7e23ef01fe2902a5))
* **git:** parse status/diff with -z so quotePath cannot mangle touched paths ([f4af785](https://github.com/muslewski/agentic-sage/commit/f4af78570b0fba54a978a53305bd60b47654b988))
* **hooks:** bound the stdin read with a real deadline (the promised watchdog) ([6f207c6](https://github.com/muslewski/agentic-sage/commit/6f207c6ff5b0e2dce8f0b53488c95995b8bcec42))
* **store:** per-file lock so concurrent merges lose no fields ([7b7c7a7](https://github.com/muslewski/agentic-sage/commit/7b7c7a74ebc8a512550e84bacc2fd493cb7f3aac))


### Performance Improvements

* **asking:** export safeSid for reuse by the throttle breadcrumb ([e08b9b7](https://github.com/muslewski/agentic-sage/commit/e08b9b771ce27207a07c807b7ce2f1970acc2a6c))
* **assets:** serve avif/webp banners via &lt;picture&gt;; npm-first setup image ([ba5e4cd](https://github.com/muslewski/agentic-sage/commit/ba5e4cd0fb693312f3271e046ab642a721103722))
* **git:** support a trunk hint in gitSignals to skip re-derivation ([dbbb2e2](https://github.com/muslewski/agentic-sage/commit/dbbb2e28f2fce3db84407bf36dd8bf3b59fcdcb0))
* **hooks:** add PostToolUse throttle breadcrumb (stat-only gate) ([2534e95](https://github.com/muslewski/agentic-sage/commit/2534e95cca5ffa5e98dcb7a87d3ff62c92fd63d2))
* **hooks:** check PostToolUse throttle before any git spawn; single repo resolve; cache trunk ([18dd10c](https://github.com/muslewski/agentic-sage/commit/18dd10cb04b6d775d73da339472822a155f85bfa))
* **repo-id:** add resolveRepo() to fold root+id into one git spawn ([e6775cb](https://github.com/muslewski/agentic-sage/commit/e6775cbfdf438efe90d8661e5b813d2799e595a2))

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


## [1.1.1] — 2026-07-23

### Added

- **Public product documentation** under `docs/` (docs-kit frontmatter, sidebar `_meta.json`, `docs:check` / `docs:health`)
- **`docs/works-with.md`** — fleet sibling map with honest interop edges
- **Contextual fleet mentions** in feature docs where integrations are real
- **Recollection soft-nudge** for docs health (memory-atlas `atlas-recollection` + docs-kit)

See [`docs/index.md`](docs/index.md) for the documentation hub.

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
