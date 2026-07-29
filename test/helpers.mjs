import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn, spawnSync } from 'node:child_process'

// Absolute path to the interpreter running this suite. Never spawn bare "node"
// under a hermetic HOME: desk PATH shims resolve via $HOME/.nvm and exit 127
// when the temp home has no nvm install. process.execPath is portable (nvm,
// system node, CI) and immune to HOME. Mossferry hit the same trap twice.
export const NODE = process.execPath

/** Env for CLI/emitter under a hermetic HOME (does not touch real user state). */
export const hermeticEnv = (home, extra = {}) => ({
  ...process.env,
  HOME: home,
  ...extra,
})

/** Spawn the suite interpreter with argv; prefer this over execFileSync('node', …). */
export const runNode = (args, opts = {}) =>
  execFileSync(NODE, args, { encoding: 'utf8', ...opts })

export const spawnNode = (args, opts = {}) => spawn(NODE, args, opts)

export const spawnNodeSync = (args, opts = {}) => spawnSync(NODE, args, opts)

export const mkTmp = (prefix = 'sage-') => fs.mkdtempSync(path.join(os.tmpdir(), prefix))

export const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()

// A temp git repo on `main` with one commit.
export const mkGitRepo = () => {
  const dir = mkTmp('sage-repo-')
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'config', 'user.email', 't@t')
  git(dir, 'config', 'user.name', 't')
  fs.writeFileSync(path.join(dir, 'README.md'), '# t\n')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-qm', 'init')
  return dir
}

// Seed ~/.claude/agentic-sage/config.json under a temp home.
export const writeGlobalConfig = (home, obj) => {
  const dir = path.join(home, '.claude', 'agentic-sage')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(obj))
}

// Seed a LEGACY ~/.claude/sage/config.json under a temp home (pre-rename
// on-disk shape) — for legacy-fallback / migration test cases.
export const writeLegacyGlobalConfig = (home, obj) => {
  const dir = path.join(home, '.claude', 'sage')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(obj))
}
