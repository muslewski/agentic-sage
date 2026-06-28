// Objective git signals for a worktree. Every call is defensive — a missing
// `main`, a fresh repo with no commits, or a non-repo path degrades to a safe
// default rather than throwing (the emitter must stay fail-open).
import { execFileSync } from 'node:child_process'

const git = (worktree, args) =>
  execFileSync('git', ['-C', worktree, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()

export const gitSignals = (worktree) => {
  let head = null
  let dirty = false
  let touched = []

  try {
    head = git(worktree, ['rev-parse', 'HEAD']) || null
  } catch {
    /* no commits yet */
  }

  try {
    dirty = git(worktree, ['status', '--porcelain']).length > 0
  } catch {
    /* ignore */
  }

  try {
    let names = ''
    try {
      // changes on this branch since it forked from main (merge-base..HEAD)
      names = git(worktree, ['diff', '--name-only', 'main...HEAD'])
    } catch {
      // no main (or detached) → fall back to working-tree changes
      names = git(worktree, ['status', '--porcelain'])
        .split('\n')
        .map((l) => l.slice(3))
        .join('\n')
    }
    touched = names
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    /* ignore */
  }

  return { head, dirty, touched }
}
