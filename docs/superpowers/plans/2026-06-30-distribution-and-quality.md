---
type: plan
spec: 2026-06-30-distribution-and-quality-design
title: Distribution & Quality — Implementation Plan
date: 2026-06-30
status: ready
execution-skill: superpowers:subagent-driven-development
---

# Distribution & Quality — Implementation Plan

> Execution skill: **superpowers:subagent-driven-development**

## Global Constraints

- **Public repo** — never write "syndcast" or any private project name in any file.
- **No MCP registry** — SAGE has no MCP server. Do not add `server.json` or a
  registry-releaser workflow.
- **No custom plugin registry** — the Claude Code marketplace is the native channel.
- **No runtime dependencies** — the package has zero runtime deps by design. Only
  `devDependencies` may be added.
- **ESM only** — all JS uses `import`/`export`, `node:` prefix for built-ins, `.mjs`
  extensions. No CommonJS.
- **Tests** — run with `node --test` (no jest/mocha). All new logic gets a test in
  `test/`. Existing 165 tests must still pass after every task.
- **Biome** style: single quotes, no semicolons (`asNeeded`), 2-space indent, 100-char
  line width. New code in `bin/`, `lib/`, `hooks/`, `install.mjs`, `scripts/` must pass
  `npx biome check` after Task 5.
- **Commit convention** — all commits use Conventional Commits (`feat:`, `fix:`,
  `chore:`, `docs:`, `ci:`, `refactor:`) so release-please can compute versions.
- **Repo root** — `/home/kento/Repositories/agentic-sage` (all paths are relative to it
  unless stated).
- **Never mention the owner's other projects** — the `author` field and all docs name
  only Mateusz Muślewski / muslewski / 10kento10@gmail.com.

---

## Task 1 — npm packaging hygiene

Add a `files` whitelist and `engines.node` to `package.json` so the npm tarball excludes
`assets/` (~11.5 MB PNGs) and `test/`.

- [ ] Read `package.json` (verify current state matches the audit).
- [ ] Edit `package.json` — insert `"files"` and `"engines"` so the full `scripts` block
  and `devDependencies` (none yet) read as follows. Preserve all existing keys exactly:

  ```json
  {
    "name": "agentic-sage",
    "version": "0.1.0",
    "type": "module",
    "description": "Passive fleet judge for parallel Claude Code sessions — board, territory checks, merge briefings.",
    "bin": { "sage": "./bin/sage" },
    "files": [
      "bin",
      "lib",
      "hooks",
      "skills",
      "adapters",
      "templates",
      "uninstall",
      "install.mjs",
      "scripts",
      "AGENTS.md",
      "SETUP.md",
      "ADAPTERS.md",
      "CONVENTIONS.md"
    ],
    "engines": {
      "node": ">=18.0.0"
    },
    "scripts": {
      "test": "node --test"
    },
    "author": "Mateusz Muślewski <10kento10@gmail.com>",
    "license": "MIT",
    "repository": {
      "type": "git",
      "url": "git+https://github.com/muslewski/agentic-sage.git"
    },
    "bugs": { "url": "https://github.com/muslewski/agentic-sage/issues" },
    "homepage": "https://github.com/muslewski/agentic-sage#readme",
    "keywords": ["claude-code", "agents", "fleet", "tmux", "git-worktree", "sessions", "orchestration"]
  }
  ```

  (Note: `description` is the short pitch from the spec. `devDependencies` will be added
  in Task 5; omit the key now if it does not exist.)

- [ ] Run `npm pack --dry-run` and confirm:
  - Zero lines containing `.png`
  - Zero lines containing `test/`
  - The tarball includes `bin/`, `lib/`, `hooks/`, `skills/`, `adapters/`, `templates/`,
    `uninstall/`, `install.mjs`

- [ ] Commit:

  ```
  chore: add files whitelist and engines.node to package.json
  ```

---

## Task 2 — Extract `lib/wiring.mjs` + tests

Extract the five wiring steps from `install.mjs` into a testable module so `sage init`
(Task 3) can reuse the same logic without duplication.

- [ ] Create `/home/kento/Repositories/agentic-sage/lib/wiring.mjs` with this exact content:

  ```javascript
  // lib/wiring.mjs — conservative ~/.claude wiring, injectable for tests.
  // Both install.mjs and `sage init` call wireAll().
  import fs from 'node:fs'
  import path from 'node:path'
  import { sageHome, globalConfig } from './paths.mjs'

  const HOOK_EVENTS = [
    'SessionStart',
    'UserPromptSubmit',
    'PostToolUse',
    'Stop',
    'PreCompact',
    'SessionEnd',
    'PreToolUse',
  ]

  /**
   * Wire SAGE into a ~/.claude directory.  Idempotent and conservative.
   * @param {{ home: string, repoRoot: string, nodeExecPath?: string, skipSkill?: boolean }} opts
   * @returns {{ gc, link, target, settingsPath, tmuxConf, tmuxNote, skillNote, sageBin }}
   */
  export function wireAll({
    home,
    repoRoot,
    nodeExecPath = process.execPath,
    skipSkill = Boolean(process.env.SAGE_SKIP_SKILL),
  }) {
    // 1. seed default-OFF global config (never clobber)
    fs.mkdirSync(sageHome(home), { recursive: true })
    const gc = globalConfig(home)
    if (!fs.existsSync(gc)) fs.writeFileSync(gc, JSON.stringify({ enabled: false }, null, 2) + '\n')

    // 2. symlink the emitter into <home>/.claude/hooks
    const hooksDir = path.join(home, '.claude', 'hooks')
    fs.mkdirSync(hooksDir, { recursive: true })
    const link = path.join(hooksDir, 'sage-emit.mjs')
    const target = path.join(repoRoot, 'hooks', 'sage-emit.mjs')
    _symlinkConservative(link, target)

    // 3. merge lifecycle hooks into settings.json — throws on malformed JSON
    const settingsPath = path.join(home, '.claude', 'settings.json')
    _mergeSettings(settingsPath, link, nodeExecPath)

    // 4. tmux fleet pane
    const tmuxConf = path.join(home, '.tmux.conf')
    const sageBin = path.join(repoRoot, 'bin', 'sage')
    const tmuxNote = _wireTmux(tmuxConf, sageBin, nodeExecPath)

    // 5. symlink skills (opt-out: skipSkill or SAGE_SKIP_SKILL=1)
    const skillNote = skipSkill ? 'skipped (SAGE_SKIP_SKILL=1)' : _wireSkills(home, repoRoot)

    return { gc, link, target, settingsPath, tmuxConf, tmuxNote, skillNote, sageBin }
  }

  /**
   * Format the wireAll result into the human-readable install summary.
   */
  export function formatResult({ gc, link, target, settingsPath, tmuxConf, tmuxNote, skillNote, sageBin }) {
    return (
      `SAGE installed — DISABLED by default.\n` +
      `  config:   ${gc}\n` +
      `  hook:     ${link} -> ${target}\n` +
      `  settings: ${settingsPath} (backed up to .bak if it existed)\n` +
      `  tmux:     ${tmuxConf} — ${tmuxNote}\n` +
      `  skills:   ~/.claude/skills — ${skillNote}\n` +
      `  pointer:  paste templates/CLAUDE.snippet.md into your repo/user CLAUDE.md to wire sessions in\n` +
      `  verify:   run \`/sage-doctor\` (or \`${sageBin} doctor\`) to validate the wiring\n` +
      `Enable when ready:  edit ${gc} → {"enabled": true}  (or: sage on)\n` +
      `Fleet line:  add \`${sageBin} fleet\` to your session-sync tick for an always-on summary.\n` +
      `Guard:    built but OFF — arm per repo with \`sage guard add <path>\` then \`sage guard on\`\n` +
      `          (blocks edits to contested paths via exit 2; fail-open + default-OFF).`
    )
  }

  // ── private helpers ────────────────────────────────────────────────────────

  function _symlinkConservative(link, target) {
    let stat = null
    try {
      stat = fs.lstatSync(link)
    } catch {
      /* absent */
    }
    if (stat) {
      if (stat.isSymbolicLink()) {
        if (fs.readlinkSync(link) !== target) {
          fs.unlinkSync(link)
          fs.symlinkSync(target, link)
        }
      } else {
        fs.renameSync(link, link + '.bak')
        fs.symlinkSync(target, link)
      }
    } else {
      fs.symlinkSync(target, link)
    }
  }

  function _mergeSettings(settingsPath, hookLink, nodeExecPath) {
    let settings = {}
    if (fs.existsSync(settingsPath)) {
      const bak = settingsPath + '.bak'
      if (!fs.existsSync(bak)) fs.copyFileSync(settingsPath, bak)
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
      } catch {
        throw new Error(
          `SAGE install ABORTED: ${settingsPath} is not valid JSON. ` +
            `Fix it and re-run — no changes were made to it.`,
        )
      }
    }
    settings.hooks = settings.hooks || {}
    const command = `${JSON.stringify(nodeExecPath)} ${JSON.stringify(hookLink)}`
    for (const ev of HOOK_EVENTS) {
      settings.hooks[ev] = settings.hooks[ev] || []
      const present = settings.hooks[ev].some((group) =>
        (group.hooks || []).some((h) => h.command === command),
      )
      if (!present) settings.hooks[ev].push({ hooks: [{ type: 'command', command }] })
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
  }

  function _wireTmux(tmuxConf, sageBin, nodeExecPath) {
    const bindLine = `bind j display-popup -E -w 90% -h 70% '${nodeExecPath} ${sageBin} board'`
    let conf = ''
    try {
      conf = fs.readFileSync(tmuxConf, 'utf8')
    } catch {
      /* no tmux.conf yet */
    }
    if (conf.includes(`${sageBin} board`)) return `already present (skipped)`
    if (conf && !fs.existsSync(tmuxConf + '.bak')) fs.copyFileSync(tmuxConf, tmuxConf + '.bak')
    fs.appendFileSync(
      tmuxConf,
      `${conf && !conf.endsWith('\n') ? '\n' : ''}# SAGE fleet pane (bind j)\n${bindLine}\n`,
    )
    return `added \`bind j\` → run \`tmux source-file ~/.tmux.conf\` to apply`
  }

  function _wireSkills(home, repoRoot) {
    const skillsDir = path.join(home, '.claude', 'skills')
    fs.mkdirSync(skillsDir, { recursive: true })
    const srcSkills = path.join(repoRoot, 'skills')
    let names = []
    try {
      names = fs
        .readdirSync(srcSkills, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch {
      /* no skills dir */
    }
    const notes = []
    for (const name of names) {
      const slink = path.join(skillsDir, name)
      const starget = path.join(srcSkills, name)
      let sst = null
      try {
        sst = fs.lstatSync(slink)
      } catch {
        /* absent */
      }
      if (sst) {
        if (sst.isSymbolicLink()) {
          if (fs.readlinkSync(slink) !== starget) {
            fs.unlinkSync(slink)
            fs.symlinkSync(starget, slink)
            notes.push(`${name}: relinked`)
          } else {
            notes.push(`${name}: linked`)
          }
        } else if (fs.existsSync(slink + '.bak')) {
          notes.push(`${name}: left as-is (${name}.bak taken)`)
        } else {
          fs.renameSync(slink, slink + '.bak')
          fs.symlinkSync(starget, slink)
          notes.push(`${name}: backed up → .bak, linked`)
        }
      } else {
        fs.symlinkSync(starget, slink)
        notes.push(`${name}: linked`)
      }
    }
    return notes.length ? notes.join('; ') : 'no skills to link'
  }
  ```

- [ ] Replace `install.mjs` with a thin wrapper (preserve the shebang and the conservative
  comments; remove the five inline steps):

  ```javascript
  #!/usr/bin/env node
  // Wire SAGE into ~/.claude.  All logic lives in lib/wiring.mjs (injectable for tests).
  import os from 'node:os'
  import path from 'node:path'
  import { fileURLToPath } from 'node:url'
  import { wireAll, formatResult } from './lib/wiring.mjs'

  const home = os.homedir()
  const repoRoot = path.dirname(fileURLToPath(import.meta.url))
  try {
    const result = wireAll({ home, repoRoot })
    console.log(formatResult(result))
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
  ```

- [ ] Create `test/wiring.test.mjs` with this exact content:

  ```javascript
  import { test } from 'node:test'
  import assert from 'node:assert/strict'
  import fs from 'node:fs'
  import path from 'node:path'
  import { fileURLToPath } from 'node:url'
  import { wireAll } from '../lib/wiring.mjs'
  import { mkTmp } from './helpers.mjs'

  // The real repo root — skills/ and hooks/ must exist for symlink tests.
  const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'PreCompact', 'SessionEnd', 'PreToolUse']

  test('wireAll: returns expected result shape', () => {
    const home = mkTmp('sage-w-')
    const r = wireAll({ home, repoRoot: REPO_ROOT })
    assert.ok(r.gc.includes('sage'))
    assert.ok(r.link.includes('sage-emit.mjs'))
    assert.ok(r.target.endsWith('hooks/sage-emit.mjs'))
    assert.ok(r.settingsPath.endsWith('settings.json'))
    assert.ok(typeof r.tmuxNote === 'string')
    assert.ok(typeof r.skillNote === 'string')
    assert.ok(r.sageBin.endsWith('bin/sage'))
  })

  test('wireAll: seeds default-OFF config and wires all 7 hook events', () => {
    const home = mkTmp('sage-w-')
    wireAll({ home, repoRoot: REPO_ROOT })
    const cfg = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'sage', 'config.json'), 'utf8'))
    assert.deepEqual(cfg, { enabled: false })
    const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'))
    for (const ev of EVENTS) assert.ok((settings.hooks[ev] || []).length >= 1, `missing ${ev}`)
  })

  test('wireAll: idempotent — second call adds no duplicate hooks', () => {
    const home = mkTmp('sage-w-')
    wireAll({ home, repoRoot: REPO_ROOT })
    wireAll({ home, repoRoot: REPO_ROOT })
    const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'))
    assert.equal(settings.hooks.Stop.length, 1)
  })

  test('wireAll: idempotent — second call does not overwrite existing config', () => {
    const home = mkTmp('sage-w-')
    wireAll({ home, repoRoot: REPO_ROOT })
    const cfg1 = fs.readFileSync(path.join(home, '.claude', 'sage', 'config.json'), 'utf8')
    wireAll({ home, repoRoot: REPO_ROOT })
    const cfg2 = fs.readFileSync(path.join(home, '.claude', 'sage', 'config.json'), 'utf8')
    assert.equal(cfg1, cfg2)
  })

  test('wireAll: malformed settings.json throws, file is left intact', () => {
    const home = mkTmp('sage-w-')
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const sp = path.join(claude, 'settings.json')
    fs.writeFileSync(sp, '{ bad json,, }')
    assert.throws(() => wireAll({ home, repoRoot: REPO_ROOT }), /ABORTED/)
    assert.equal(fs.readFileSync(sp, 'utf8'), '{ bad json,, }')
  })

  test('wireAll: skipSkill=true skips the skill symlink', () => {
    const home = mkTmp('sage-w-')
    wireAll({ home, repoRoot: REPO_ROOT, skipSkill: true })
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'sage-fleet')), false)
  })

  test('wireAll: symlinks skills into ~/.claude/skills', () => {
    const home = mkTmp('sage-w-')
    wireAll({ home, repoRoot: REPO_ROOT })
    const slink = path.join(home, '.claude', 'skills', 'sage-fleet')
    assert.equal(fs.lstatSync(slink).isSymbolicLink(), true)
    assert.match(fs.readFileSync(path.join(slink, 'SKILL.md'), 'utf8'), /name:\s*sage-fleet/)
  })

  test('wireAll: hook symlink — real-file collision backed up, relinked', () => {
    const home = mkTmp('sage-w-')
    const hooksDir = path.join(home, '.claude', 'hooks')
    fs.mkdirSync(hooksDir, { recursive: true })
    const link = path.join(hooksDir, 'sage-emit.mjs')
    fs.writeFileSync(link, '// original')
    wireAll({ home, repoRoot: REPO_ROOT })
    assert.equal(fs.lstatSync(link).isSymbolicLink(), true)
    assert.equal(fs.readFileSync(link + '.bak', 'utf8'), '// original')
  })
  ```

- [ ] Run `node --test test/wiring.test.mjs` — all 8 tests pass.
- [ ] Run `node --test` — full suite (165+8 = 173+ tests) passes, zero failures.
- [ ] Commit:

  ```
  refactor: extract lib/wiring.mjs, thin install.mjs wrapper, add wiring tests
  ```

---

## Task 3 — `sage init` subcommand + postinstall hint

Add the `sage init` subcommand and a hint-only postinstall script so npm-installed users
know to run it.

- [ ] Create `scripts/postinstall.mjs` with this exact content:

  ```javascript
  #!/usr/bin/env node
  // Hint-only postinstall — no filesystem writes; safe under --ignore-scripts / CI.
  const bold = (s) => `\x1b[1m${s}\x1b[0m`
  process.stdout.write(
    `\n  agentic-sage installed.\n  Run ${bold('sage init')} to wire skills and hooks into ~/.claude\n\n`,
  )
  ```

- [ ] Edit `bin/sage`:
  - Update the USAGE constant — insert the `init` line immediately before `doctor`:
    ```
      adapter init         scaffold .sage/adapter.mjs from the template
      init                 wire skills + hooks into ~/.claude (run after npm install)
      doctor               validate dirs / hook / settings / token-forecast
      statusline           the "Asking Sage" status-bar segment (empty unless consulting)`
    ```
  - Add `case 'init':` to the switch statement, immediately before `case 'doctor':`:
    ```javascript
        case 'init': {
          const { wireAll, formatResult } = await import('../lib/wiring.mjs')
          const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
          let result
          try {
            result = wireAll({ home, repoRoot })
          } catch (e) {
            console.error(e.message)
            process.exit(1)
          }
          return console.log(formatResult(result))
        }
    ```

- [ ] Edit `package.json` — add `"postinstall"` to `scripts` and add
  `"scripts/postinstall.mjs"` to the `files` array (or keep `"scripts"` which already
  covers the directory):

  ```json
  "scripts": {
    "test": "node --test",
    "postinstall": "node scripts/postinstall.mjs"
  }
  ```

  (The `"scripts"` entry in `files` from Task 1 already covers `scripts/postinstall.mjs`;
  no change to `files` needed.)

- [ ] Manually verify: `HOME=/tmp/sage-init-test node bin/sage init` — outputs the install
  summary; `node scripts/postinstall.mjs` — prints the hint, exits 0.
- [ ] Run `node --test` — full suite still passes.
- [ ] Commit:

  ```
  feat: add sage init subcommand and postinstall hint
  ```

---

## Task 4 — Claude Code marketplace registration

Register both skills in the Claude Code plugin marketplace.

- [ ] Create `.claude-plugin/marketplace.json` with this exact content:

  ```json
  {
    "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
    "name": "agentic-sage",
    "description": "Passive fleet judge for parallel Claude Code sessions — board, territory checks, merge briefings.",
    "owner": {
      "name": "Mateusz Muślewski",
      "url": "https://github.com/muslewski"
    },
    "plugins": [
      {
        "name": "sage-fleet",
        "description": "Use when starting work, before opening a PR, or resolving a merge conflict while other agent sessions may be running in parallel on the same repo. Coordinate through the sage CLI — collision check, claim intent, merge brief, why-diverged — so parallel sessions merge smoothly. Advisory only; a silent no-op when SAGE is off or not installed.",
        "source": "./",
        "category": "productivity"
      },
      {
        "name": "sage-doctor",
        "description": "Validate the SAGE fleet-judge install — config, emitter hook, settings wiring, linked skills, current repo. Trigger: /sage-doctor",
        "source": "./",
        "category": "productivity"
      }
    ]
  }
  ```

- [ ] Verify `skills/sage-fleet/SKILL.md` frontmatter `description` contains the trigger
  phrases already present (starting work, before opening a PR, resolving a merge conflict,
  other agent sessions may be running in parallel). If any are missing, add them.
- [ ] Verify `skills/sage-doctor/SKILL.md` frontmatter includes `user-invocable: true` and
  the `/sage-doctor` trigger. If missing, add.
- [ ] Commit:

  ```
  feat: add .claude-plugin/marketplace.json for Claude Code marketplace
  ```

---

## Task 5 — Biome lint/format

Add biome as the single dev dependency for lint + format.

- [ ] Run `npm install --save-dev @biomejs/biome` (installs latest stable biome).
- [ ] Create `biome.json` with this content (update `$schema` version to match the
  installed version if different from `1.9.4`):

  ```json
  {
    "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
    "files": {
      "include": [
        "bin/**",
        "lib/**",
        "hooks/**",
        "install.mjs",
        "scripts/**"
      ]
    },
    "organizeImports": {
      "enabled": false
    },
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "lineWidth": 100
    },
    "javascript": {
      "formatter": {
        "quoteStyle": "single",
        "semicolons": "asNeeded",
        "trailingCommas": "all"
      }
    },
    "linter": {
      "enabled": true,
      "rules": {
        "recommended": true
      }
    }
  }
  ```

- [ ] Edit `package.json` — add `lint` and `format` to scripts:

  ```json
  "scripts": {
    "test": "node --test",
    "postinstall": "node scripts/postinstall.mjs",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
  ```

- [ ] Run `npx biome check --write` — auto-fixes formatting. Review the diff; for any
  linter finding that would change runtime behavior or break intent, add an inline
  `// biome-ignore <rule>: <reason>` comment instead of accepting the auto-fix.
- [ ] Run `npx biome check` — zero errors.
- [ ] Run `node --test` — full suite still passes.
- [ ] Commit:

  ```
  chore: add biome lint/format config and scripts
  ```

---

## Task 6 — CI workflow

Add a GitHub Actions workflow that gates every push and PR on lint + tests.

- [ ] Create `.github/workflows/ci.yml` with this exact content:

  ```yaml
  name: CI

  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]

  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true

  jobs:
    lint-and-test:
      name: Lint + Test (Node ${{ matrix.node }})
      runs-on: ubuntu-latest
      strategy:
        matrix:
          node: ['18', '20', '22']
        fail-fast: false

      steps:
        - uses: actions/checkout@v4

        - uses: actions/setup-node@v4
          with:
            node-version: ${{ matrix.node }}
            cache: npm

        - name: Install dev dependencies
          run: npm install --ignore-scripts

        - name: Biome check
          run: npx biome check .

        - name: Run tests
          run: node --test
  ```

- [ ] Commit:

  ```
  ci: add GitHub Actions CI workflow (lint + test, Node 18/20/22)
  ```

---

## Task 7 — Publish + release-please workflows

Add automated npm publish on `v*` tags and release-please for conventional-commit-driven
version bumps.

- [ ] Create `release-please-config.json`:

  ```json
  {
    "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
    "packages": {
      ".": {
        "release-type": "node",
        "changelog-sections": [
          { "type": "feat", "section": "Features" },
          { "type": "fix", "section": "Bug Fixes" },
          { "type": "perf", "section": "Performance Improvements" },
          { "type": "docs", "section": "Documentation", "hidden": true },
          { "type": "chore", "section": "Miscellaneous", "hidden": true },
          { "type": "ci", "section": "Miscellaneous", "hidden": true },
          { "type": "refactor", "section": "Miscellaneous", "hidden": true }
        ]
      }
    }
  }
  ```

- [ ] Create `.release-please-manifest.json`:

  ```json
  {
    ".": "0.1.0"
  }
  ```

- [ ] Create `.github/workflows/release-please.yml`:

  ```yaml
  name: Release Please

  on:
    push:
      branches: [main]

  permissions:
    contents: write
    pull-requests: write

  jobs:
    release-please:
      runs-on: ubuntu-latest
      steps:
        - uses: googleapis/release-please-action@v4
          with:
            config-file: release-please-config.json
            manifest-file: .release-please-manifest.json
  ```

- [ ] Create `.github/workflows/publish.yml`:

  ```yaml
  name: Publish to npm

  on:
    push:
      tags: ['v*']

  permissions:
    contents: read
    id-token: write  # Required for --provenance attestation

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4

        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            registry-url: 'https://registry.npmjs.org'
            cache: npm

        - name: Install dependencies
          run: npm install --ignore-scripts

        - name: Publish with provenance
          run: npm publish --provenance --access public
          env:
            NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  ```

  **Human action required after merging:** add `NPM_TOKEN` (a granular npm access token
  scoped to `agentic-sage` with publish permission) as a repository secret at
  `github.com/muslewski/agentic-sage/settings/secrets/actions`.

- [ ] Commit:

  ```
  ci: add release-please and npm publish workflows
  ```

---

## Task 8 — Repo hygiene docs

Add the standard OSS hygiene files that make GitHub surface the repo as maintained.

- [ ] Create `CONTRIBUTING.md`:

  ```markdown
  # Contributing to agentic-sage

  Thank you for your interest!

  ## Dev setup

  ```bash
  git clone https://github.com/muslewski/agentic-sage.git
  cd agentic-sage
  npm install          # installs biome (dev dep); no runtime deps
  node install.mjs     # wire into your own ~/.claude to dogfood while developing
  ```

  ## Running tests

  ```bash
  node --test          # all tests (node:test, no external runner)
  node --test test/wiring.test.mjs   # single file
  ```

  Tests are hermetic — they create temp HOME directories and never touch your real `~/.claude`.

  ## Adapters

  See [ADAPTERS.md](./ADAPTERS.md) for how to write a per-project adapter and test it.

  ## Commit convention

  This project uses [Conventional Commits](https://www.conventionalcommits.org/) because
  release-please uses them to compute version bumps and write CHANGELOG.md automatically.

  | Prefix | Effect |
  |---|---|
  | `feat:` | minor version bump; appears in CHANGELOG |
  | `fix:` | patch bump; appears in CHANGELOG |
  | `perf:` | patch bump; appears in CHANGELOG |
  | `docs:`, `chore:`, `ci:`, `refactor:` | patch / no bump; hidden in CHANGELOG |

  Breaking changes: add `!` after the type (`feat!:`) or a `BREAKING CHANGE:` footer.

  ## Pull requests

  1. Fork and create a branch: `git checkout -b fix/what-you-fix`.
  2. Write a test if your change is logic-touching.
  3. Run `node --test` and `npx biome check .` — both must pass.
  4. Open a PR against `main` with a descriptive title and the PR template filled in.

  ## Reporting issues

  Use the GitHub issue templates (bug report or feature request). For security issues, see
  [SECURITY.md](./SECURITY.md).
  ```

- [ ] Create `CODE_OF_CONDUCT.md`:

  ```markdown
  # Contributor Covenant Code of Conduct

  ## Our Pledge

  We as members, contributors, and leaders pledge to make participation in our community a
  harassment-free experience for everyone, regardless of age, body size, visible or
  invisible disability, ethnicity, sex characteristics, gender identity and expression,
  level of experience, education, socioeconomic status, nationality, personal appearance,
  race, caste, color, religion, or sexual identity and orientation.

  We pledge to act and interact in ways that contribute to an open, welcoming, diverse,
  inclusive, and healthy community.

  ## Our Standards

  Examples of behavior that contributes to a positive environment:

  - Demonstrating empathy and kindness toward other people
  - Being respectful of differing opinions, viewpoints, and experiences
  - Giving and gracefully accepting constructive feedback
  - Accepting responsibility and apologizing to those affected by our mistakes
  - Focusing on what is best for the overall community

  Examples of unacceptable behavior:

  - The use of sexualized language or imagery, and sexual attention or advances of any kind
  - Trolling, insulting or derogatory comments, and personal or political attacks
  - Public or private harassment
  - Publishing others' private information without explicit permission
  - Other conduct which could reasonably be considered inappropriate in a professional setting

  ## Enforcement Responsibilities

  Community leaders are responsible for clarifying and enforcing our standards of acceptable
  behavior and will take appropriate and fair corrective action in response to any behavior
  that they deem inappropriate, threatening, offensive, or harmful.

  ## Scope

  This Code of Conduct applies within all community spaces, and also applies when an
  individual is officially representing the community in public spaces.

  ## Enforcement

  Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to
  the project maintainer at **10kento10@gmail.com** or via a
  [GitHub private security report](https://github.com/muslewski/agentic-sage/security/advisories/new).
  All complaints will be reviewed and investigated promptly and fairly.

  ## Attribution

  This Code of Conduct is adapted from the
  [Contributor Covenant](https://www.contributor-covenant.org), version 2.1.
  ```

- [ ] Create `SECURITY.md`:

  ```markdown
  # Security Policy

  ## Supported versions

  | Version | Supported |
  |---|---|
  | 0.1.x | Yes |

  ## Reporting a vulnerability

  **Please do not open a public GitHub issue for security vulnerabilities.**

  Report privately via
  [GitHub's private security advisory](https://github.com/muslewski/agentic-sage/security/advisories/new)
  or email **10kento10@gmail.com** with the subject line `[SECURITY] agentic-sage`.

  Include:
  - A description of the vulnerability
  - Steps to reproduce
  - Potential impact
  - Any suggested fix (optional)

  You will receive a response within 72 hours. We aim to release a patch within 14 days of
  a confirmed vulnerability.

  ## Scope

  agentic-sage is a local CLI that reads git history and writes to `~/.claude`. It has no
  network server and no external API calls. The primary risk surface is:

  - Path traversal via untrusted adapter input
  - Symlink race conditions during install/uninstall
  - Injected shell commands via hook configuration

  Out of scope: issues in Node.js itself, GitHub Actions runners, or the user's OS.
  ```

- [ ] Create `.github/ISSUE_TEMPLATE/1-bug.yml`:

  ```yaml
  name: Bug report
  description: Something isn't working as expected
  labels: [bug, needs-triage]
  body:
    - type: markdown
      attributes:
        value: |
          Thanks for taking the time to file a bug report. Please fill in as much detail as
          possible so we can reproduce and fix it quickly.

    - type: textarea
      id: description
      attributes:
        label: What happened?
        description: A clear description of the bug.
      validations:
        required: true

    - type: textarea
      id: steps
      attributes:
        label: Steps to reproduce
        description: Exact commands you ran, in order.
        placeholder: |
          1. `sage board`
          2. ...
      validations:
        required: true

    - type: textarea
      id: expected
      attributes:
        label: Expected behavior
        description: What did you expect to see?
      validations:
        required: true

    - type: textarea
      id: actual
      attributes:
        label: Actual behavior
        description: What did you see instead? Include full error output if any.
      validations:
        required: true

    - type: input
      id: version
      attributes:
        label: agentic-sage version
        description: Output of `sage --version` or the version in package.json
        placeholder: "0.1.0"
      validations:
        required: true

    - type: input
      id: node
      attributes:
        label: Node.js version
        description: Output of `node --version`
        placeholder: "v22.x.x"
      validations:
        required: true

    - type: input
      id: os
      attributes:
        label: OS
        placeholder: "macOS 15 / Ubuntu 24 / etc."
      validations:
        required: true
  ```

- [ ] Create `.github/ISSUE_TEMPLATE/2-feature.yml`:

  ```yaml
  name: Feature request
  description: Suggest an improvement or new capability
  labels: [enhancement]
  body:
    - type: markdown
      attributes:
        value: |
          Please describe the problem your feature would solve before proposing a solution —
          it helps evaluate fit and find simpler alternatives.

    - type: textarea
      id: problem
      attributes:
        label: What problem does this solve?
        description: "Example: I'm always frustrated when..."
      validations:
        required: true

    - type: textarea
      id: solution
      attributes:
        label: Proposed solution
        description: Describe what you'd like to happen.
      validations:
        required: true

    - type: textarea
      id: alternatives
      attributes:
        label: Alternatives considered
        description: Any other approaches you've thought about?

    - type: textarea
      id: context
      attributes:
        label: Additional context
        description: Anything else relevant (screenshots, links, prior art, etc.)
  ```

- [ ] Create `.github/PULL_REQUEST_TEMPLATE.md`:

  ```markdown
  ## What does this PR do?

  <!-- 1-3 bullet points describing the change -->

  ## Type of change

  - [ ] Bug fix (non-breaking change that fixes an issue)
  - [ ] New feature (non-breaking change that adds functionality)
  - [ ] Breaking change (fix or feature that changes existing behavior)
  - [ ] Documentation / tooling only

  ## Secret pattern check

  Confirm this PR contains none of the following patterns (grep the diff):

  - [ ] No `ghp_` (GitHub personal access token)
  - [ ] No `sk-` (API key prefix)
  - [ ] No `AKIA` (AWS access key ID)
  - [ ] No `xoxb-` or `xoxp-` (Slack tokens)
  - [ ] No hardcoded passwords, tokens, or private paths

  ## Testing

  - [ ] `node --test` passes locally
  - [ ] `npx biome check .` passes locally
  - [ ] New behavior is covered by a test (or explain why not)

  ## Notes for reviewer

  <!-- Anything the reviewer should pay particular attention to -->
  ```

- [ ] Create `.editorconfig`:

  ```ini
  root = true

  [*]
  charset = utf-8
  end_of_line = lf
  indent_style = space
  indent_size = 2
  insert_final_newline = true
  trim_trailing_whitespace = true

  [*.md]
  trim_trailing_whitespace = false
  ```

- [ ] Create `.github/dependabot.yml`:

  ```yaml
  version: 2
  updates:
    - package-ecosystem: npm
      directory: "/"
      schedule:
        interval: weekly
      open-pull-requests-limit: 5

    - package-ecosystem: github-actions
      directory: "/"
      schedule:
        interval: weekly
      open-pull-requests-limit: 5
  ```

- [ ] Create `CHANGELOG.md`:

  ```markdown
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
  ```

- [ ] Run `node --test` — still passing.
- [ ] Commit:

  ```
  docs: add CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue templates, PR template, editorconfig, dependabot, CHANGELOG
  ```

---

## Task 9 — README upgrade

Add shields.io badges and reorder README sections to follow the dify-style convention
(hero → nav → badges → pitch → quickstart → install → how it works → community → license).

- [ ] Read the current `README.md` to identify existing section headers and the hero image
  reference.

- [ ] Edit `README.md` to match the following structure. Keep all existing body copy within
  its new position — this is a reorder + badge addition, not a rewrite:

  **Top of file (replace the opening through the first pitch paragraph):**

  ```markdown
  <p align="center">
    <img src="./assets/sage-banner.png" alt="SAGE — the fleet judge" width="900">
  </p>

  <p align="center">
    <a href="#install">Install</a> ·
    <a href="#how-it-works">How it works</a> ·
    <a href="./SETUP.md">Full setup guide</a> ·
    <a href="./ADAPTERS.md">Adapters</a> ·
    <a href="https://github.com/muslewski/agentic-sage/releases">Changelog</a>
  </p>

  <p align="center">
    <a href="https://www.npmjs.com/package/agentic-sage">
      <img src="https://img.shields.io/npm/v/agentic-sage?label=npm&style=flat" alt="npm version">
    </a>
    <a href="https://github.com/muslewski/agentic-sage/actions/workflows/ci.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/muslewski/agentic-sage/ci.yml?label=CI&style=flat" alt="CI">
    </a>
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="MIT license">
    <img src="https://img.shields.io/badge/node-%3E%3D18-blue?style=flat" alt="Node >=18">
  </p>
  ```

  **Install section** — replace the existing install steps with three surfaces:

  ```markdown
  ## Install

  **Option 1 — global npm (recommended):**

  ```bash
  npm install -g agentic-sage
  sage init                    # wires skills + hooks into ~/.claude
  sage on                      # enable globally (default OFF)
  ```

  **Option 2 — Claude Code marketplace:**

  ```
  /plugin marketplace add muslewski/agentic-sage
  /plugin install
  ```

  Skills (`sage-fleet`, `sage-doctor`) are linked; no further setup needed for skill-only
  use. To use the `sage` CLI verbs (`board`, `territory`, …) also run the global npm
  install above.

  **Option 3 — git clone (for contributors / local development):**

  ```bash
  git clone https://github.com/muslewski/agentic-sage.git
  cd agentic-sage
  node install.mjs             # same as sage init, from source
  sage on
  ```

  > **Demo:** a board-spinner asciinema recording is planned — see
  > [#tracking-issue](https://github.com/muslewski/agentic-sage/issues) for status.
  ```

  **Community section** — add before License:

  ```markdown
  ## Community

  - [Issues](https://github.com/muslewski/agentic-sage/issues) — bugs + feature requests
  - [Discussions](https://github.com/muslewski/agentic-sage/discussions) — Q&A + ideas
  - [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute
  ```

- [ ] Commit:

  ```
  docs: upgrade README — badges, nav links, three install surfaces, community section
  ```

---

## Task 10 — awesome-claude-code submission doc

Document the exact GitHub issue form payload for the human to submit.

- [ ] Create `docs/awesome-claude-code-submission.md`:

  ```markdown
  # awesome-claude-code Submission

  Submit a GitHub issue at:
  `https://github.com/hesreallyhim/awesome-claude-code/issues/new/choose`

  Select template: **"🚀 Recommend New Resource"**

  ---

  ## Form payload

  **Display Name:**
  ```
  agentic-sage
  ```

  **Category:** (pick from dropdown)
  ```
  Agent Skills
  ```

  **Sub-Category:** (optional, leave blank or pick if available)
  ```
  Fleet / Multi-Agent
  ```

  **Primary Link:**
  ```
  https://github.com/muslewski/agentic-sage
  ```

  **Secondary Link:** (optional)
  ```
  https://www.npmjs.com/package/agentic-sage
  ```

  **Author Name:**
  ```
  muslewski
  ```

  **Author Link:**
  ```
  https://github.com/muslewski
  ```

  **License:**
  ```
  MIT
  ```

  **Description:**
  ```
  Passive read-only fleet judge for parallel Claude Code sessions. Installs as a global
  CLI (`sage`) plus two Claude Code skills (`sage-fleet`, `sage-doctor`). Sessions call
  `sage territory` / `sage claim` / `sage merge-brief` to coordinate without colliding;
  the human reads `sage board` for fleet altitude. Default OFF, zero runtime deps.
  ```

  **Validate Claims** (required for skills/plugins):
  ```
  Install: npm install -g agentic-sage && sage init && sage on
  In a git repo with two terminal sessions both running Claude Code, run `sage board`
  in either — it lists both live sessions, their branch, and their claimed globs.
  Run `sage territory 'src/**'` in one session to confirm overlap detection works.
  ```

  ---

  ## Notes

  - The bot validates: URL accessibility, no duplicates, all required fields present.
  - Maintainer runs `/approve` or `/request-changes` after review.
  - On approve, the bot adds the entry to `THE_RESOURCES_TABLE.csv` and regenerates the
    README via an auto-PR.
  - This is a manual step — do not automate submission.
  ```

- [ ] Run `node --test` — full suite passes (no code changed in this task).
- [ ] Commit:

  ```
  docs: add awesome-claude-code submission payload
  ```

---

## Completion checklist

After all 10 tasks are committed:

- [ ] `npm pack --dry-run` shows zero `.png` files; tarball is under 200 KB.
- [ ] `node --test` — all tests pass (≥173).
- [ ] `npx biome check .` — zero errors.
- [ ] `.claude-plugin/marketplace.json` present with both skills registered.
- [ ] `.github/workflows/ci.yml`, `publish.yml`, `release-please.yml` present.
- [ ] All hygiene docs present: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  `CHANGELOG.md`, `.editorconfig`, `.github/dependabot.yml`, issue templates, PR template.
- [ ] `README.md` has badge row and three install surfaces.
- [ ] `docs/awesome-claude-code-submission.md` present.
- [ ] **Human action:** add `NPM_TOKEN` repo secret in GitHub settings.
- [ ] **Human action:** submit awesome-claude-code GitHub issue using the payload in
  `docs/awesome-claude-code-submission.md`.
- [ ] **Human action:** for initial npm publish — run `npm publish` manually once, then
  all subsequent releases are automated via release-please + publish workflow.
