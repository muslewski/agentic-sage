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
    timeout: 3000,
  }).trim()

/**
 * Resolve the stable main-repo identity path for any cwd (including a worktree).
 * - Normal layout (`<main>/.git`): returns the main worktree root.
 * - Relocated gitdir / bare common dir: returns the realpath of the common dir
 *   itself (dirname would be a random parent, not the repo).
 * Realpathed so the id is stable across symlinks. null when not a git repo.
 */
export const resolveRepoRoot = (cwd) => {
  try {
    const common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
    if (!common) return null
    const real = fs.realpathSync(common)
    // Standard: …/repo/.git → main root is parent
    if (path.basename(real) === '.git') {
      return fs.realpathSync(path.dirname(real))
    }
    // Relocated gitdir (e.g. /storage/foo.git) or bare: identity is the common dir.
    return real
  } catch {
    return null
  }
}

/**
 * Resolve the *current worktree* checkout root (not the main root).
 * Nested worktrees and linked worktrees get their own path — used for
 * session.worktree so outer and nested-inner stay distinct.
 */
export const resolveWorktreeRoot = (cwd) => {
  try {
    const top = git(cwd, ['rev-parse', '--path-format=absolute', '--show-toplevel'])
    if (!top) return null
    return fs.realpathSync(top)
  } catch {
    return null
  }
}

export const resolveRepoId = (cwd) => {
  const root = resolveRepoRoot(cwd)
  return root ? repoIdFromRoot(root) : null
}

// Root + id in ONE git spawn path — emitter needs both; worktree is separate.
export const resolveRepo = (cwd) => {
  const root = resolveRepoRoot(cwd)
  if (!root) return null
  const worktree = resolveWorktreeRoot(cwd) || root
  return { root, id: repoIdFromRoot(root), worktree }
}
