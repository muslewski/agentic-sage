// Objective git signals for a worktree. Every call is defensive — a missing
// trunk, a fresh repo with no commits, or a non-repo path degrades to a safe
// default rather than throwing (the emitter must stay fail-open). Each git
// child has a hard `timeout` so a hung git (lock wait, credential prompt) can
// never freeze the hook — execFileSync kills it and we fall back.
import { execFileSync } from 'node:child_process'

const git = (worktree, args) =>
  execFileSync('git', ['-C', worktree, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 3000,
  }).trim()

// Best-effort default-branch (trunk) name — NOT hardcoded `main`, since SAGE
// is project-agnostic. Prefer origin/HEAD, else the first local main/master.
const trunkOf = (worktree) => {
  try {
    const ref = git(worktree, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'])
    if (ref) return ref.replace('refs/remotes/origin/', '')
  } catch {
    /* no origin */
  }
  for (const c of ['main', 'master']) {
    try {
      git(worktree, ['rev-parse', '--verify', '--quiet', c])
      return c
    } catch {
      /* not this one */
    }
  }
  return 'main'
}

export const gitSignals = (worktree) => {
  let head = null
  let porcelain = ''

  try {
    head = git(worktree, ['rev-parse', 'HEAD']) || null
  } catch {
    /* no commits yet */
  }
  try {
    porcelain = git(worktree, ['status', '--porcelain'])
  } catch {
    /* not a repo */
  }

  const touched = new Set()

  // committed work since this branch forked from trunk (empty when on trunk)
  try {
    const trunk = trunkOf(worktree)
    const names = git(worktree, ['diff', '--name-only', `${trunk}...HEAD`])
    for (const n of names.split('\n')) {
      const t = n.trim()
      if (t) touched.add(t)
    }
  } catch {
    /* no trunk / detached — porcelain below still covers uncommitted work */
  }

  // uncommitted working-tree changes — ALWAYS unioned in (this is what makes a
  // docs-on-`main` session show territory, since trunk...HEAD is empty there).
  // Do NOT trim the porcelain line: the first two chars are status flags.
  for (const line of porcelain.split('\n')) {
    if (line.length < 4) continue
    const p = line.slice(3)
    const arrow = p.indexOf(' -> ') // rename: "old -> new"
    touched.add(arrow >= 0 ? p.slice(arrow + 4) : p)
  }

  return { head, dirty: porcelain.length > 0, touched: [...touched] }
}
