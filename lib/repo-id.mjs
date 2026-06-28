// Stable per-repo id. A git worktree resolves to the SAME id as its main
// checkout, because both share one --git-common-dir. Not a git repo ⇒ null.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// Pure: derive the id from an already-resolved root path string.
export const repoIdFromRoot = (root) => {
  const base = path.basename(root)
  const hash = crypto.createHash('sha256').update(root).digest('hex').slice(0, 8)
  return `${base}-${hash}`
}

const git = (cwd, args) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()

// Resolve the main repo root for any cwd (including a worktree). Realpathed so
// the id is stable across symlinks. Returns null when cwd is not in a git repo.
export const resolveRepoRoot = (cwd) => {
  try {
    const common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
    if (!common) return null
    // --git-common-dir → <main>/.git (absolute); its parent is the main root.
    return fs.realpathSync(path.dirname(common))
  } catch {
    return null
  }
}

export const resolveRepoId = (cwd) => {
  const root = resolveRepoRoot(cwd)
  return root ? repoIdFromRoot(root) : null
}
