---
type: spec
summary: "Design: SAGE init/config UX + configurable storage scope"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-01-init-config-storage-ux-design.md"
related: []
sources: []
---

# Design: SAGE init/config UX + configurable storage scope

- **Date:** 2026-07-01
- **Status:** Approved design → ready to implement directly from this spec.
- **PR theme:** *better init/config UX + configurable storage scope*
- **Repo:** `agentic-sage` (this repository). Node ≥ 20, pure ESM. CLI entry `bin/sage`; npm-install emitter hook `hooks/sage-emit.mjs`.
- **Scope note:** this spec file lives under `docs/superpowers/`, which is gitignored — the spec itself is not committed. The shipped artifact is the **code changes + updated public docs**, committed with conventional commits.

## 0. For the implementing agent (start here)

You are picking this up cold — there is no prior conversation to rely on; **this document is the source of truth.** Do this:

1. **Read the whole spec once**, then read **Appendix A (Current code map)** to ground yourself in the code as it exists today.
2. **Write your own phased implementation plan** from §16, one phase at a time. Each phase must leave the repo green (`node --test`) and is a natural commit boundary. Do **not** attempt the whole epic in one pass.
3. **TDD:** for each unit, write the failing test first, then the minimal code. Tests run with `node --test`.
4. **Follow the low-risk implementation strategy in §6.1** — it is the result of a prior aborted attempt and avoids an invasive, test-breaking refactor. In particular: keep existing `(home, id)` function signatures, reroute internals, and defer the `agentic-sage` on-disk rename to its own late phase.
5. Commit per phase with **conventional commits** (`feat:`/`refactor:`/`test:`/`docs:`/`chore:`). Never hand-edit `CHANGELOG.md` — release-please generates it from commit messages.
6. Work on a feature branch, not `main`.

### Hard constraints (violating any of these is a regression)

- **Emitter fail-open:** `hooks/sage-emit.mjs` must always `exit(0)` on any error. A broken SAGE must never block a Claude Code hook.
- **Emitter default-OFF fast path:** when globally disabled, the emitter must exit **before spawning any git process** (tier-1 check is one small file read). Do not add git/fs work ahead of that gate.
- **Preserve multi-worktree coordination:** all worktrees of a repo must resolve to **one** shared data dir (see §6, §12). Resolve the repo's main root via `git --git-common-dir`, never from cwd.
- **No forced migration / no data loss:** existing `~/.claude/sage/` installs must keep working after an `npm update` with no re-init (§11).
- **Style (Biome):** no semicolons, single quotes, 2-space indent, trailing commas. Run `npm run lint` before committing. (Note: `biome.json` `files.includes` currently omits `test/`, so test files are not linted — match style by hand there.)
- **Node ≥ 20, pure ESM** (`import`/`export`, `.mjs`).

## 1. Problem

`sage init` dumps 12 dense lines that wrap in a terminal — "chaotic," hard to scan. Two deeper gaps:

1. **No visible scope control.** SAGE is *already* per-repo (state keyed by repo-id under `~/.claude/sage/repos/<id>/`) and *already* global-master + per-repo, but none of this is surfaced at init. Users can't tell "is this global or just this project?" or choose.
2. **Hardcoded storage location.** Everything lives under `~/.claude/sage/`. Users want the data root to be configurable (agent-home / next-to-repo / repo-root) and to pick per project.

Plus a branding inconsistency: on-disk paths say `sage`, which should be `agentic-sage` for consistency.

## 2. Goals

- Clean, minimal `sage init` output; full detail on demand.
- Interactive init wizard (skill-installer style) + non-interactive flags for agents/CI.
- Two independent axes made explicit: **install scope** (where the hook is wired) and **storage root** (where data lives).
- Configurable storage root with a documented precedence chain.
- Re-runnable per project even after a global install.
- On-disk naming consistency: `agentic-sage` everywhere; `sage` only as a typed interface.
- `sage doctor` reports problems **with remedy commands**; add `sage init --repair` and `sage where`.
- Preserve SAGE's core value: multi-worktree/multi-session coordination.
- Full public-doc pass (README, SETUP, AGENTS, CONVENTIONS, ADAPTERS, templates).
- No data loss on upgrade; conventional-commit-driven CHANGELOG (release-please).

## 3. Non-goals (YAGNI)

- Multi-harness *wiring* (Cursor/Codex/etc.) — architecture is made B-ready, but only `claude` is populated now.
- Objective/subjective state split — dropped (was a brainstorming riff).
- Per-worktree storage — dropped; nothing SAGE-related lives per-worktree.
- Repo-id scheme change — stays `basename-hash8` (collision-safe); UI shows friendly `basename`.
- A config knob to rename the CLI — superseded by shipping both binaries.

## 4. Vocabulary — two independent axes

- **Install scope** = *where the emitter hook is wired.*
  - `global` → `~/.claude/settings.json` (fires in every session). Win: new repos need only `sage enable`, no re-wire.
  - `project` → `<repo>/.claude/settings.json` (fires only in that repo). Self-contained; hook + data travel together.
- **Storage root** = *where a repo's data lives.* Independent of scope. Presets: `agent-home`, `sibling`, `repo-root`.

## 5. Naming consistency

One-line rule: **anything a user types stays `sage`; anything on disk becomes `agentic-sage`.**

| Surface | Rule | Result |
|---|---|---|
| CLI binary | exception (typed) | `sage` primary **+ `agentic-sage` alias** (both in `package.json` `bin`) |
| Slash/skill names | exception (typed) | `/sage-doctor`, `/sage-fleet` (skill dirs unchanged) |
| Env vars | exception (typed) | `SAGE_*` (e.g. `SAGE_OPT_OUT`, `SAGE_SELF_SID`, `SAGE_STORAGE_ROOT`, `SAGE_SCOPE`) |
| Brand in prose/output | proper noun | "SAGE" |
| Storage root (home) | `agentic-sage` | `~/.claude/agentic-sage/` |
| In-repo dir | `agentic-sage` | `<repo>/.agentic-sage/` |
| Config files | `agentic-sage` | `…/agentic-sage/config.json` |
| Hook emitter file | `agentic-sage` | `~/.claude/hooks/agentic-sage-emit.mjs` |

## 6. Storage resolution (core new logic)

New function `resolveRepoDataDir({ home, mainRoot, repoId, env })` → absolute path to the dir holding this repo's `{config.json, sessions/, events.ndjson, guard.json}`. First hit wins:

```
0. $SAGE_STORAGE_ROOT               power-user / test override
1. in-repo marker <mainRoot>/.agentic-sage/config.json  → use the root it names
                                    (default: the .agentic-sage/ beside it; may name a sibling/custom path)
2. central registry: repos[id].root recorded per-project override in home
3. global config .defaultRoot       user's chosen convention (.claude/.agents/custom)
4. ~/.claude/agentic-sage           new built-in default
5. ~/.claude/sage                   LEGACY default — used only if #4 absent (back-compat)
```

Note: **install scope** (where the hook is wired) and **storage root** (where data lives) are independent (§4). A project-scoped install may still choose agent-home storage; a global install may choose repo-root storage. The marker (#1) and registry (#2) record *storage* location, resolved regardless of how the hook was wired.

Data-dir shape by location:

```
agent-home / sibling:  <root>/repos/<id>/{config.json, sessions/, events.ndjson, guard.json}
repo-root:             <mainRoot>/.agentic-sage/{config.json, sessions/, events.ndjson, guard.json}
```

The `repos/<id>/` layer is dropped only for repo-root scope (the dir is already repo-specific). `resolveRepoDataDir` hides this — callers only ever receive a resolved dir.

**Always resolve `mainRoot` from `git --git-common-dir`, never from cwd.** Every worktree of a repo agrees on one data dir → coordination survives. This *is* the "worktrees shouldn't create their own folder" rule, enforced in code.

## 6.1 Recommended implementation strategy (low-risk — read before touching `paths.mjs`)

A prior attempt changed every path helper to take a resolved `dataDir` and rippled the new signature through ~15 call sites. That is invasive and breaks tests mid-refactor. **Do this instead:**

- **Keep the existing `(home, id)` / `(home, id, sid)` signatures of `paths.mjs`.** Reroute their *internals* through `resolveRepoDataDir`. Callers (`store.mjs`, `guard.mjs`, `control.mjs`, `enabled.mjs`, `bin/sage`, the emitter) do not change.

  ```
  repoDir(home, id)          = resolveRepoDataDir({ home, repoId: id })   // id-only; no mainRoot
  sessionsDir(home, id)      = <repoDir>/sessions
  sessionFile(home, id, sid) = <repoDir>/sessions/<sid>.json
  eventsFile(home, id)       = <repoDir>/events.ndjson
  guardConfig(home, id)      = <repoDir>/guard.json
  repoConfig(home, id)       = <repoDir>/config.json
  ```

- **The registry is the id→dataDir index.** Because `paths.mjs` callers only have `(home, id)` (not `mainRoot`), the id-only branch of `resolveRepoDataDir` cannot read the in-repo marker. Bridge this: the **cwd-aware entry points** (the emitter and each `bin/sage` command — both have `cwd` → can compute `mainRoot`) run the full resolver *and*, on first touch of a project-scoped repo, write `registry.repos[id] = { dataDir, scope, mainRoot }`. Subsequent id-only lookups then resolve correctly via the registry (precedence #2).

- **Avoid a `paths.mjs` ↔ resolver import cycle:** put `sageHome` (and the resolver) in a **new module** (e.g. `lib/roots.mjs`) and have `paths.mjs` import from it — not the reverse. `paths.mjs` may re-export `sageHome` for back-compat with existing importers (e.g. `test/control.test.mjs`).

- **Global-level paths stay in agent-home** and are resolved separately from repo data:

  ```
  globalConfig(home)  = <agentHome>/agentic-sage/config.json   (legacy fallback: <home>/.claude/sage/config.json)
  registry(home)      = <agentHome>/agentic-sage/registry.json
  ```

- **Defer the `agentic-sage` on-disk rename (§5) to its own late phase (§16 phase 5).** In earlier phases keep the built-in default literal path as today's `~/.claude/sage/...` so `test/paths.test.mjs` (which asserts `/.claude/sage/repos/...` literally) stays green. The rename phase flips the default to `agentic-sage`, adds the legacy fallback, and updates those literal-path tests in the same commit.

Net effect: foundations land as pure additive/internal-reroute changes with **zero behavior change** and all existing tests green; scope, naming, and UX layer on top.

## 7. Enable model v2

Master switch + global defaults **always** live in agent-home global config. Per-repo config = `config.json` in the repo's resolved data dir.

```
opt-out (SAGE_OPT_OUT / .sage-ignore)  → OFF   (always wins)
project scope:  enabled unless repoCfg.enabled === false   (running init on a project implies opt-in)
global scope:   globalMaster && repoCfg.enabled !== false
```

- `sage on|off` → global master (agent-home). Unchanged.
- `sage enable|disable` → writes the resolved repo's `config.json` `{enabled}`.

### Emitter perf + double-fire

- **Global hook** (in `~/.claude/settings.json`): keeps the cheap zero-git tier-1 gate — master OFF ⇒ exit before any git. Preserves "a disabled machine spawns zero git per hook."
- **Project hook** (in `<repo>/.claude/settings.json`): wired with `--scope=project` (or `SAGE_SCOPE=project`); skips the global gate and owns its repo.
- **Double-fire guard:** if a global-scoped hook resolves a repo that is project-scoped (marker present), it defers (exits) so the project hook owns it. Prevents duplicate records/events when both hooks exist.

## 8. `sage init` — wizard + flags + output

### Interactive (TTY)

```
sage init
  ? Scope       › Global (recommended) / This project only
  ? Harness     › claude            (only option now; "pick your…" UX, B-ready)
  ? Storage     › [contextual presets from scope + harness]
                    global  → ~/.claude/agentic-sage (default) / ~/.agents/... / custom
                    project → <repo>/.agentic-sage (default) / sibling / agent-home
  ? Enable now  › No, stay OFF (default) / Yes
  → wire, then:

  ✓ SAGE wired · global · DISABLED
    storage  ~/.claude/agentic-sage
    next     sage on   ·   sage doctor
    details  sage init --show
```

### Non-interactive (agents / CI / non-TTY)

```
sage init --global [--enable]
sage init --project [--path <dir>] [--yes] [--enable]
sage init --repair
sage init --show        # full path breakdown (grouped + colored via paint())
```

- No flags + no TTY → safe defaults (global, OFF), then print exactly what it did.
- **npm postinstall stays non-interactive** — no wizard during `npm install`; it prints "run `sage init`". Wizard is `sage init`-only.

## 9. Commands: added / upgraded

- **`sage where`** (new) — prints resolved scope, data dir, and which precedence rule matched. The storage-locator.
- **`sage doctor`** (upgraded) — each failed check prints the problem **and** a remedy command, e.g. `✗ storage missing → run: sage init --repair`. Also shows scope + data dir + precedence hit.
- **`sage init --repair`** — relink hook (new + legacy names), recreate missing dirs, rewrite marker/registry. Folds the "auto-fix the obvious" idea; no separate command.
- **`sage enable|disable`** (new) — per-repo `{enabled}` in the repo data dir (distinct from global `on|off`).
- `sage repos` — must **aggregate across roots**: scan agent-home `repos/` + registry-indexed external roots.

## 10. Harness profiles (A now, B-ready)

New `lib/harness.mjs`: a table of profiles:

```
{
  claude: {
    id, home(h), settings(h), projectSettings(root),
    hooksDir(h), skillsDir(h), storageDefault(h), tmux: true,
  },
  // cursor / codex … added later = one row each (the whole B unlock)
}
```

`wireAll` becomes profile-driven; the wizard's "pick your harness" lists profile ids (only `claude` now). Storage default derives from the chosen profile's `storageDefault`.

## 11. Back-compat & migration

**No forced migration.** Legacy paths auto-resolve so nothing breaks on `npm update` before a re-init:

| Old | New | Handling |
|---|---|---|
| `~/.claude/sage/` | `~/.claude/agentic-sage/` | precedence #5 legacy fallback (automatic, read-only); `sage init` / `--repair` does a safe atomic rename (skipped if both exist) |
| `~/.claude/sage/config.json` | `~/.claude/agentic-sage/config.json` | global-config resolver checks new path, falls back to legacy |
| `sage-emit.mjs` | `agentic-sage-emit.mjs` | tolerant substring match on both; init rewires; uninstall + doctor match both |
| `.sage/adapter.mjs` | `.agentic-sage/adapter.mjs` | `.sage/` honored as read-alias |

Repo dir stays `basename-hash8` on disk (no id migration); UI shows friendly `basename`.

## 12. Worktree safety

- `mainRoot` always via `git --git-common-dir` → one data dir per repo across all worktrees.
- When `repo-root` storage is chosen **from a linked worktree**, `init` refuses and redirects to the main root, so a worktree can never scaffold a stray `.agentic-sage/`.

## 13. Docs (first-class deliverable)

- **README.md** — quickstart rewrite (interactive init, scope/storage table).
- **SETUP.md** — walkthrough with flags + storage precedence.
- **AGENTS.md** — runbook: non-interactive flags + scope decision.
- **CONVENTIONS.md** — storage layout + precedence + naming rule.
- **ADAPTERS.md** — in-repo dir is `.agentic-sage/` (`.sage/` legacy alias).
- **templates/CLAUDE.snippet.md** — update if scope changes the pasted pointer.
- **CHANGELOG.md** — not hand-edited; driven by conventional commits via release-please.

## 14. Risks

1. `paths.mjs` signature ripple (~15 files + tests) — mechanical, do as one well-tested pass.
2. Double-fire when both global + project hooks exist — §7 defer guard.
3. Emitter perf regression — preserve zero-git-when-globally-off; project hook carries `--scope=project`.
4. `sage repos` aggregation across roots — registry is the index.
5. Uninstall surface grows — must reverse project hooks, in-repo dirs, registry entries, both hook filenames.
6. Legacy rename safety — never clobber; if both old+new exist, prefer new + warn.

## 15. Test surface

- New: `test/storage-resolve.test.mjs` (precedence chain, worktree resolution), `test/init-wizard.test.mjs` (flag parsing / non-interactive / defaults), enable-model v2 (project vs global scope), legacy-fallback + rename migration.
- Update: `test/install.test.mjs`, `test/cli.test.mjs`, `test/uninstall.test.mjs` for new signatures + names.

## 16. Rollout (implementation phases)

Sequential; each phase ends green and is one commit boundary. Follow §6.1 throughout.

1. **Foundations:** new `lib/roots.mjs` (`sageHome` + registry helpers + `resolveRepoDataDir` precedence, default path kept as today's `~/.claude/sage`), `lib/harness.mjs` profile table, and reroute `paths.mjs` internals through the resolver **keeping all signatures**. Pure additive/internal — **no behavior change**, every existing test stays green (esp. `test/paths.test.mjs`).
2. **Enable v2 + emitter:** scope-aware `isEnabled`, project hook carries `--scope=project`, double-fire defer guard. Entry points (emitter + `bin/sage`) compute `mainRoot` from cwd, run the full resolver, and write the registry index on first touch (§6.1).
3. **Wiring v2:** profile-driven `wireAll`, project-scope wiring into `<repo>/.claude/settings.json`, `.agentic-sage/` marker writer.
4. **CLI UX:** interactive `sage init` wizard, flags, clean output + `--show`, `sage where`, `sage enable/disable`, doctor remedies + `--repair`, `sage repos` aggregation.
5. **Naming sweep + migration:** flip built-in default to `~/.claude/agentic-sage` with legacy fallback (§11); rename `sage-emit.mjs → agentic-sage-emit.mjs` (tolerant match); `.sage/`/legacy read-aliases; safe atomic rename on `init`/`--repair`; add `agentic-sage` bin alias in `package.json`. **Update the literal-path tests** (`test/paths.test.mjs`, and any asserting `sage-emit`) in this phase.
6. **Docs pass** (§13).

Tests are written **within** each phase (TDD), not deferred to the end.

## Appendix A. Current code map (as of this spec)

Where the relevant logic lives **today** and the signatures you'll touch. Verify against the actual files before editing.

- **`bin/sage`** — CLI dispatcher. `main()` switches on `argv[2]`: `board fleet territory why-diverged merge-brief repos on off link unlink claim backlog guard statusline adapter init doctor`. `on|off` → `setEnabled(home, …)` (global master). `init` → `wireAll({ home, repoRoot })` then prints `formatResult(result)`. All stdout is colorized at one chokepoint via `paint()` (`lib/color.mjs`). *New commands go here:* `where`, `enable`, `disable`, and `init` flag parsing.
- **`hooks/sage-emit.mjs`** — the emitter; fires on every hook event, fail-open (`process.exit(0)` always). Flow: read hook JSON from stdin → `isGloballyEnabled(home)` (tier-1, no git) → `PreToolUse && !guardsActive(home)` fast-exit → `resolveRepoId(cwd)` → `isEnabled({ home, repoId, cwd })` → `switch (hook_event_name)` writing records/events via `store.mjs`. *This is the perf-critical path — §7's `--scope=project` handling and registry-index bootstrap go here.*
- **`lib/paths.mjs`** — `sageHome(home)=~/.claude/sage`, `globalConfig(home)`, `repoDir(home,id)`, `repoConfig(home,id)`, `sessionsDir(home,id)`, `sessionFile(home,id,sid)`, `eventsFile(home,id)`, `guardConfig(home,id)`, `guardsActiveFlag(home)`. *Reroute internals per §6.1; keep signatures.*
- **`lib/enabled.mjs`** — `isGloballyEnabled(home)` (reads `globalConfig` `{enabled:true}`); `isEnabled({ home, repoId, cwd, env })` = tier-1 global ∧ tier-2 per-repo (`repoConfig` `{enabled:false}` override) ∧ tier-3 opt-out (`SAGE_OPT_OUT`, `<cwd>/.sage-ignore`). *§7 makes this scope-aware.*
- **`lib/repo-id.mjs`** — `resolveRepoRoot(cwd)` (via `git rev-parse --git-common-dir`, realpathed → **main** root, stable across worktrees), `resolveRepoId(cwd)`, `repoIdFromRoot(root)=<basename>-<sha256(root)[:8]>`. *This is the `mainRoot` source for §6/§12 — reuse it, don't reinvent.*
- **`lib/store.mjs`** — `readRecord(home,id,sid)`, `mergeRecord(home,id,sid,patch)`, `appendEvent(home,id,evt)`, `atomicWriteJson`, `readJson`. Consumes `sessionFile`/`eventsFile` from `paths.mjs` (so it follows the reroute for free).
- **`lib/wiring.mjs`** — `wireAll({ home, repoRoot, nodeExecPath, skipSkill })`: seeds default-OFF `globalConfig` (never clobbers), symlinks `hooks/sage-emit.mjs` → `~/.claude/hooks/sage-emit.mjs`, merges `HOOK_EVENTS` (`SessionStart UserPromptSubmit PostToolUse Stop PreCompact SessionEnd PreToolUse`) into `~/.claude/settings.json` (`.bak` backup, throws on malformed JSON), adds tmux `bind j`, symlinks `skills/*`. `formatResult(result)` → the current 12-line dump (**this is the "chaotic" output to redesign**). Both `install.mjs` and `sage init` call these. *§8/§10 make this profile-driven + project-scope-aware.*
- **`lib/control.mjs`** — `setEnabled(home,on)` (merges into `globalConfig`, preserves other keys), `listRepos(home)` (reads `<sageHome>/repos` — §9 must also read the registry), `doctor(home,cwd)` → `checks[]`, `renderDoctor(checks)`. *§9 adds remedy lines + scope/data-dir/precedence output.*
- **`lib/guard.mjs`** — `guardsActive(home)` (reads `guardsActiveFlag`), `readGuard(home,id)`, `targetPath`, `relForRepo`, `shouldBlock`, `blockMessage`. Guard config lives in the repo data dir (follows the reroute).
- **`lib/adapter.mjs`** — optional per-repo adapter loader; today at `<repo>/.sage/adapter.mjs`. §11 makes `<repo>/.agentic-sage/` primary, `.sage/` a read-alias.
- **`lib/color.mjs`** — `paint(text)`; no-op when piped / `NO_COLOR`. Reuse for the new clean/`--show` output.
- **`install.mjs`** — thin wrapper over `wireAll`+`formatResult`. **`scripts/postinstall.mjs`** — hint-only, no fs writes (keep it that way; the wizard is `sage init`-only). **`package.json`** — `bin: { sage }` (add `agentic-sage` alias in phase 5), `scripts.test = node --test`, `lint = biome check .`.
- **Tests that assert literal names** (update in phase 5, not before): `test/paths.test.mjs` (`/.claude/sage/repos/…`, `/.claude/sage/config.json`), `test/wiring.test.mjs` / `test/install.test.mjs` / `test/uninstall.test.mjs` (`sage-emit.mjs`). **`test/helpers.mjs`** provides `mkGitRepo()`, `writeGlobalConfig(home, obj)` (seeds `~/.claude/sage/config.json`), `mkTmp()`.
