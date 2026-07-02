import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

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
