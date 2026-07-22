---
type: spec
id: 2026-06-30-distribution-and-quality-design
title: Distribution & Quality Design
date: 2026-06-30
status: approved
author: Mateusz Muślewski
---

# Distribution & Quality Design

## Background

SAGE is a public JS/Node CLI — a passive, read-only fleet judge for parallel Claude Code
sessions. As of 2026-06-30 the core is feature-complete: 165 passing tests, zero runtime
dependencies, idempotent conservative install, and a clean safety model.

What is missing is the distribution and quality layer. The npm tarball contains ~11.5 MB of
PNG assets and 20+ test files (99% dead weight). `npm i -g agentic-sage` produces a broken
install — the `sage` binary lands but `install.mjs` is never called, so no skills or hooks
are wired. The tool appears installed but does nothing. No CI, no publish automation, no
marketplace registration, no repo hygiene.

Current state (from audit):

| Area | Status |
|---|---|
| npm tarball | Bloated: 6 PNG files (~11.5 MB) + test/ included |
| `npm i -g` wiring | Broken: bin available, nothing wired |
| Claude Code marketplace | `.claude-plugin/marketplace.json` absent |
| CI | No `.github/` directory at all |
| Lint/format | No tooling |
| Release automation | None |
| Repo hygiene | LICENSE + README only |
| Discoverability | Not on npm, not in awesome-claude-code |

## Problem

1. **npm install is broken** — tarball is bloated; wiring never runs automatically.
2. **Zero discovery surface** — not published to npm; not registered in the Claude Code
   marketplace; not in awesome-claude-code.
3. **No quality gate** — no CI, no lint; correctness is convention-only.
4. **Maintenance friction** — releases require manual steps; no dependabot; no CHANGELOG
   automation.
5. **Thin contributor surface** — no CONTRIBUTING, SECURITY, issue templates, or PR template.

## Goals

- Ship a clean npm tarball (no PNGs, no test files; sub-100 KB).
- Make `npm i -g agentic-sage && sage init` a fully working, idempotent install path.
- Register in the Claude Code plugin marketplace (`/plugin marketplace add
  muslewski/agentic-sage`).
- Gate every push/PR on lint + tests via CI.
- Automate releases: conventional commits → release PR → tag → npm publish with provenance,
  no stored secrets required after initial setup.
- Add standard OSS hygiene so GitHub and contributors see a maintained project.
- Write an awesome-claude-code submission doc for manual human submission.

## Non-Goals

- **MCP registry** — SAGE has no MCP server component. An MCP registry listing would be
  inaccurate. Explicitly out of scope.
- **Custom plugin registry** — the Claude Code plugin marketplace is the native registry. A
  bespoke self-hosted registry would reinvent it and require permanent hosting. Explicitly
  out of scope.
- **i18n / translated READMEs** — not warranted at v0.1.
- **Docker image or binary releases** — the tool is a pure Node CLI; npm is the right
  distribution channel.

## Design Decisions

### D1 — Node floor: `>=18.0.0`

The code uses `node:` protocol imports and ESM (`type: "module"` in package.json). The test
suite uses `node --test` (the built-in test runner), which landed in Node 18.0.0 (stable).
Floor = `18`. CI matrix: Node 18, 20, 22.

### D2 — Install wiring: `lib/wiring.mjs` + `sage init` + postinstall hint

`install.mjs` currently performs five steps in a top-level script: seed the disabled global
config, symlink the emitter hook, merge lifecycle hooks into `settings.json`, wire the tmux
bind, symlink skills. This logic is extracted into `lib/wiring.mjs` as a `wireAll({home,
repoRoot, nodeExecPath?, skipSkill?})` function with injectable parameters, so tests can pass
temp HOME directories without subprocess overhead.

`install.mjs` becomes a five-line wrapper that calls `wireAll`. A new `case 'init':` in
`bin/sage` calls the same module — no duplication. The npm `postinstall` script (a new
`scripts/postinstall.mjs`) prints a one-liner hint only — no filesystem writes — safe under
`--ignore-scripts` and in CI environments.

Tests for the wiring module live in `test/wiring.test.mjs` and import `wireAll` directly
(unit-style), complementing the existing subprocess-style tests in `install.test.mjs`.

### D3 — Biome for lint + format

Single `@biomejs/biome` dev dependency — zero install friction for a zero-runtime-deps
project. `biome.json` is scoped to `bin/`, `lib/`, `hooks/`, `install.mjs`, `scripts/`
(skips `adapters/` example code and `test/` to minimize churn). Formatter configured to
match the existing codebase style: single quotes, no semicolons (`asNeeded`), 2-space
indent, 100-char line width. `biome check --write` is applied once during task execution;
any intent-preserving suppressions get an inline `// biome-ignore` comment.

### D4 — OIDC provenance publish + release-please

`npm publish` uses `--provenance` with `id-token: write` (supply-chain attestation via
GitHub Actions OIDC). Authentication uses `NPM_TOKEN` repo secret. After the package is
initially published, npm's Granular Access Tokens ("Trusted Publishers") can replace the
stored secret — but only once the package exists on npm.

Release-please watches `main` for conventional commits, opens a release PR that bumps
`version` in `package.json` and writes `CHANGELOG.md`, and tags on merge. The `v*` tag
triggers the publish workflow. The human merges the release PR; automation never merges
itself.

Commit convention (required for release-please):
- `feat:` → minor bump, appears in CHANGELOG
- `fix:` → patch bump, appears in CHANGELOG
- `chore:`, `docs:`, `ci:`, `refactor:` → patch / no bump, hidden in CHANGELOG

### D5 — Marketplace registration: two skills, `source: "./"`

`.claude-plugin/marketplace.json` registers both `sage-doctor` and `sage-fleet` as separate
plugins with `source: "./"` (the repo root, where `skills/` lives). User install path:
`/plugin marketplace add muslewski/agentic-sage` → `/plugin install`.

Both SKILL.md `description` fields already contain load-bearing trigger phrases. `sage-fleet`
fires on "starting work", "before opening a PR", "resolving a merge conflict while other
agent sessions may be running in parallel". `sage-doctor` fires on `/sage-doctor` (explicit
user-invocable). No changes needed to trigger phrases.

## Workstreams

| WS | Title | Priority | Maps to plan task |
|---|---|---|---|
| WS1 | npm packaging hygiene | P0 | Task 1 |
| WS2 | Install wiring (`lib/wiring.mjs` + `sage init` + postinstall) | P0 | Tasks 2–3 |
| WS3 | Claude Code marketplace registration | P1 | Task 4 |
| WS4 | Biome lint/format | P1 | Task 5 |
| WS5 | CI workflow | P1 | Task 6 |
| WS6 | Publish + release-please | P2 | Task 7 |
| WS7 | Repo hygiene docs | P2 | Task 8 |
| WS8 | README upgrade | P2 | Task 9 |
| WS9 | awesome-claude-code submission doc | P3 | Task 10 |

### WS1 — npm packaging hygiene

Add a `files` whitelist to `package.json` that includes only the runtime-essential paths:
`bin`, `lib`, `hooks`, `skills`, `adapters`, `templates`, `uninstall`, `install.mjs`,
`scripts`, `AGENTS.md`, `SETUP.md`, `ADAPTERS.md`, `CONVENTIONS.md`. The `assets/` directory
(6 PNGs, ~11.5 MB) and `test/` are omitted. README.md, LICENSE, and package.json are always
included by npm regardless of `files`. Add `"engines": { "node": ">=18.0.0" }`. Verify with
`npm pack --dry-run` showing zero `.png` files and no `test/` entries.

### WS2 — Install wiring

Extract the five wiring steps from `install.mjs` into `lib/wiring.mjs`:

```
wireAll({ home, repoRoot, nodeExecPath?, skipSkill? })
  → { gc, link, target, settingsPath, tmuxConf, tmuxNote, skillNote, sageBin }
formatResult(result) → string
```

Private helpers `_symlinkConservative`, `_mergeSettings`, `_wireTmux`, `_wireSkills` are
unexported. `_mergeSettings` throws an `Error` on malformed JSON (instead of
`process.exit(1)`) so callers can catch and decide; both `install.mjs` and `sage init` catch
and call `process.exit(1)`.

`test/wiring.test.mjs` imports `wireAll` directly (no subprocess) and covers: happy-path
result shape, idempotency, malformed JSON throw (file untouched), `skipSkill: true`,
skills-symlink discipline.

### WS3 — `sage init` subcommand + postinstall

Add `case 'init':` to the switch in `bin/sage` (before `default:`). Update the USAGE string.
The case resolves `repoRoot` from `import.meta.url`, calls `wireAll`, catches errors, prints
with `formatResult`. Add `scripts/postinstall.mjs` (hint only, no writes). Add `"postinstall":`
to `package.json` scripts.

### WS4 — Marketplace registration

Create `.claude-plugin/marketplace.json`:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "agentic-sage",
  "description": "Passive fleet judge for parallel Claude Code sessions — board, territory checks, merge briefings.",
  "owner": { "name": "Mateusz Muślewski", "url": "https://github.com/muslewski" },
  "plugins": [
    {
      "name": "sage-fleet",
      "description": "<sage-fleet SKILL.md description verbatim>",
      "source": "./",
      "category": "productivity"
    },
    {
      "name": "sage-doctor",
      "description": "<sage-doctor SKILL.md description verbatim>",
      "source": "./",
      "category": "productivity"
    }
  ]
}
```

SKILL.md descriptions are already suitable trigger phrases — no changes needed.

### WS5 — Biome lint/format

Install `@biomejs/biome` as a `devDependency`. Create `biome.json` scoped to `bin/**`,
`lib/**`, `hooks/**`, `install.mjs`, `scripts/**`. Add `"lint"` and `"format"` to
`package.json` scripts. Run `biome check --write`; inline any suppressions.

### WS6 — CI

`.github/workflows/ci.yml`: on push + PR, run `biome check` then `node --test` on a Node
matrix `[18, 20, 22]`. Concurrent jobs (matrix). Cancel in-progress on same branch.

### WS7 — Publish + release-please

`.github/workflows/publish.yml`: triggers on `v*` tags, runs `npm publish --provenance
--access public` with `id-token: write` + `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`.

`.github/workflows/release-please.yml`: triggers on push to `main`, uses
`googleapis/release-please-action@v4` with `release-please-config.json` (release-type: node)
and `.release-please-manifest.json` (initial version `"0.1.0"`). Human note: add `NPM_TOKEN`
as a repo secret in GitHub settings before first publish.

### WS8 — Repo hygiene

Files to create:

| File | Contents |
|---|---|
| `CONTRIBUTING.md` | Dev setup, `node --test`, conventional commits, PR process |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1 |
| `SECURITY.md` | Vulnerability reporting via GitHub private report |
| `.github/ISSUE_TEMPLATE/1-bug.yml` | Bug report form |
| `.github/ISSUE_TEMPLATE/2-feature.yml` | Feature request form |
| `.github/PULL_REQUEST_TEMPLATE.md` | Includes secret-pattern checklist (`ghp_`, `sk-`, `AKIA`, `xox[bp]`) |
| `.editorconfig` | UTF-8, LF, 2-space indent, final newline |
| `.github/dependabot.yml` | npm + github-actions weekly |
| `CHANGELOG.md` | Keep-a-Changelog format, initial `[Unreleased]` + `[0.1.0]` entry |

### WS9 — README upgrade

Badge row (after hero image, before pitch text): npm version, CI, license MIT, Node >=18 —
all using shields.io `flat` style. Section order: hero → nav links → badge row → one-line
pitch → Quickstart → Install (three surfaces: global + `sage init`, marketplace, git-clone)
→ How it works → Community → License. Add an asciinema/GIF placeholder note (board spinner
demo — asset not yet recorded; noted as a follow-up TODO, not a blocker).

### WS10 — awesome-claude-code submission

`docs/awesome-claude-code-submission.md` captures the exact GitHub issue form payload (all
required fields: Display Name, Category, Primary Link, Author Name, Author Link, License,
Description, Validate Claims sentence). This is a manual step for the human — submit a
GitHub issue at `hesreallyhim/awesome-claude-code`. The plan's final task documents the
payload and does not automate submission.
