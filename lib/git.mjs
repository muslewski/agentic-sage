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

export const branchOf = (worktree) => {
  try {
    return git(worktree, ['rev-parse', '--abbrev-ref', 'HEAD'])
  } catch {
    return null
  }
}

// Tier-2 conflict drill-down (P4): real numstat between two refs for one file.
// Both refs live in one repo's shared object DB (worktrees of one repo), so this
// is a true cross-branch diff. Defensive — any failure (bad ref, missing file,
// non-repo) degrades to [], never throws (consistent with the fail-open emitter).
export const crossStat = (worktree, refA, refB, file) => {
  try {
    // core.quotePath=false covers the common case (paths with bytes >= 0x80).
    // Paths containing a literal `"` or control characters may still arrive
    // C-quoted here — accepted, since this only feeds a +N/-N display line.
    const out = git(worktree, [
      '-c',
      'core.quotePath=false',
      'diff',
      '--numstat',
      `${refA}...${refB}`,
      '--',
      file,
    ])
    if (!out) return []
    return out.split('\n').map((line) => {
      const [added, deleted, f] = line.split('\t')
      return { file: f, added: Number(added) || 0, deleted: Number(deleted) || 0 }
    })
  } catch {
    return []
  }
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
    porcelain = git(worktree, ['status', '--porcelain', '-z'])
  } catch {
    /* not a repo */
  }

  const touched = new Set()

  // committed work since this branch forked from trunk (empty when on trunk)
  // -z: NUL-separated, never C-quoted — safe for unicode/space filenames
  // (core.quotePath defaults to true and would otherwise mangle them, e.g.
  // `café.ts` -> `"caf\303\251.ts"`).
  try {
    const trunk = trunkOf(worktree)
    const names = git(worktree, ['diff', '--name-only', '-z', `${trunk}...HEAD`])
    for (const n of names.split('\0')) {
      if (n) touched.add(n)
    }
  } catch {
    /* no trunk / detached — porcelain below still covers uncommitted work */
  }

  // uncommitted working-tree changes — ALWAYS unioned in (this is what makes a
  // docs-on-`main` session show territory, since trunk...HEAD is empty there).
  // -z entries are NUL-separated `XY path` (status flags, then a space, then
  // the path at index 3 — same offset as non-`-z` mode, but never C-quoted).
  // A rename/copy entry (X or Y is R/C) is followed by one extra NUL token
  // holding the ORIGINAL path — consume it so it isn't misread as its own
  // `XY path` entry (the ` -> ` arrow form only exists outside `-z` mode).
  const entries = porcelain.split('\0')
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (e.length < 4) continue
    touched.add(e.slice(3))
    if (e[0] === 'R' || e[0] === 'C' || e[1] === 'R' || e[1] === 'C') i++
  }

  return { head, dirty: porcelain.length > 0, touched: [...touched] }
}
