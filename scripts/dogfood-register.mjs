#!/usr/bin/env node
// Seed/refresh a SAGE session record so dogfood subagents can claim / judge.
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { mergeRecord } from '../lib/store.mjs'
import { resolveRepoId, resolveRepoRoot } from '../lib/repo-id.mjs'
import { gitSignals } from '../lib/git.mjs'

const home = process.env.HOME || os.homedir()
const sid = process.env.SAGE_SELF_SID
if (!sid) {
  console.error('SAGE_SELF_SID required')
  process.exit(1)
}
const cwd = process.cwd()
const repoId = resolveRepoId(cwd)
if (!repoId) {
  console.error('not a git repo: ' + cwd)
  process.exit(1)
}
let branch = null
try {
  branch = execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
} catch {
  branch = null
}
const sig = gitSignals(cwd) || {}
const role = process.argv.includes('--judge') ? 'judge' : undefined
const patch = {
  session_id: sid,
  repo_id: repoId,
  worktree: cwd,
  branch: branch || sig.branch || null,
  head: sig.head ?? null,
  dirty: !!sig.dirty,
  touched_globs: sig.touched_globs || [],
  trunk: sig.trunk ?? null,
  pid: process.pid,
  status: 'active',
  link_state: 'linked',
  liveness: 'working',
  source: 'dogfood',
  managed_by: 'nested',
  agent_kind: 'grok',
  opened_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_tool_at: new Date().toISOString(),
  last_prompt_at: new Date().toISOString(),
}
if (role) {
  patch.role = 'judge'
}
mergeRecord(home, repoId, sid, patch)
console.log(JSON.stringify({ ok: true, sid, repoId, pid: process.pid, role: role || 'worker', worktree: cwd }))
