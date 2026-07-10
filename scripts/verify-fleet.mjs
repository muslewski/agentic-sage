#!/usr/bin/env node
// Sandboxed end-to-end check: does the emitter → store → board pipeline work
// on THIS machine's node/git? Never touches your real ~/.claude or ~/.grok.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkGitRepo } from '../test/helpers.mjs'
import { mkSandboxHome, emit, readSession } from '../test/e2e-helpers.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { collectSessions, renderBoard } from '../lib/board.mjs'

let fail = 0
const check = (name, fn) => {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    fail++
    console.log(`  ✗ ${name} — ${e.message}`)
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

console.log('sage verify-fleet (sandboxed)')
const { home } = mkSandboxHome()
const repo = mkGitRepo()
const repoId = resolveRepoId(repo)

check('claude dialect SessionStart → record', () => {
  emit(home, { hook_event_name: 'SessionStart', session_id: 'vf-claude', cwd: repo })
  assert(readSession(home, repoId, 'vf-claude'), 'no record written')
})
check('grok dialect session_start → record', () => {
  emit(home, { hookEventName: 'session_start', sessionId: 'vf-grok', cwd: repo })
  assert(readSession(home, repoId, 'vf-grok'), 'no record written')
})
check('worktree child shares the board', () => {
  const wt = path.join(repo, '.claude', 'worktrees', 'vf-wt')
  fs.mkdirSync(path.dirname(wt), { recursive: true })
  execFileSync('git', ['-C', repo, 'worktree', 'add', wt, '-b', 'vf-branch'], { stdio: 'ignore' })
  emit(home, { hookEventName: 'session_start', sessionId: 'vf-child', cwd: wt })
  const sessions = collectSessions(home, repoId, Date.now())
  assert(sessions.length === 3, `expected 3 sessions, got ${sessions.length}`)
  assert(renderBoard(sessions, { repoId }).includes('3 sessions'), 'board render mismatch')
})

console.log(fail === 0 ? 'verify-fleet: all checks passed' : `verify-fleet: ${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
