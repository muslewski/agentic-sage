#!/usr/bin/env node
// Long-lived dogfood session: holds a real PID so SAGE liveness + brief freshness work.
// Usage:
//   SAGE_SELF_SID=df-w1 node scripts/dogfood-keeper.mjs worker --claim 'dogfood-notes/**' --seconds 90
//   SAGE_SELF_SID=df-judge-fleet node scripts/dogfood-keeper.mjs judge --scope fleet --seconds 90
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mergeRecord, readRecord } from '../lib/store.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { gitSignals } from '../lib/git.mjs'

const home = process.env.HOME || os.homedir()
const sid = process.env.SAGE_SELF_SID
if (!sid) {
  console.error('SAGE_SELF_SID required')
  process.exit(1)
}

const args = process.argv.slice(2)
const mode = args[0] === 'judge' ? 'judge' : 'worker'
const flag = (n) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : undefined
}
const has = (n) => args.includes(n)
const seconds = Number(flag('--seconds') || 90)
const scope = flag('--scope') || 'repo' // fleet | repo
const claimGlobs = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--claim' && args[i + 1]) claimGlobs.push(args[++i])
}

const cwd = process.cwd()
const repoId = resolveRepoId(cwd)
if (!repoId) {
  console.error('not a git repo')
  process.exit(1)
}

const sageBin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'sage')
const runSage = (argv, { input } = {}) =>
  spawnSync(process.execPath, [sageBin, ...argv], {
    cwd,
    env: { ...process.env, HOME: home, SAGE_SELF_SID: sid },
    encoding: 'utf8',
    input,
  })

const refresh = (extra = {}) => {
  let branch = null
  try {
    branch = execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    /* ignore */
  }
  const sig = gitSignals(cwd) || {}
  // gitSignals returns { touched, dirty, head, trunk } — map to session field.
  const touched = [...(sig.touched || [])]
  mergeRecord(home, repoId, sid, {
    session_id: sid,
    repo_id: repoId,
    worktree: cwd,
    branch: branch || sig.branch || null,
    head: sig.head ?? null,
    dirty: !!sig.dirty,
    touched_globs: touched,
    trunk: sig.trunk ?? null,
    pid: process.pid, // THIS process stays alive
    status: 'active',
    link_state: 'linked',
    source: 'dogfood-keeper',
    managed_by: 'nested',
    agent_kind: 'grok',
    opened_at: readRecord(home, repoId, sid)?.opened_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_tool_at: new Date().toISOString(),
    last_prompt_at: new Date().toISOString(),
    ...extra,
  })
}

const log = (msg) => console.log(`[${sid}] ${msg}`)

refresh(mode === 'judge' ? { role: 'judge', judge_scope: scope, judge_at: new Date().toISOString() } : {})
log(`registered pid=${process.pid} mode=${mode} repo=${repoId}`)

if (mode === 'judge') {
  const on = runSage(['judge', 'on', `--${scope}`, '--takeover'])
  log(`judge on: ${(on.stdout || on.stderr || '').trim()}`)
} else if (claimGlobs.length) {
  const c = runSage(['claim', ...claimGlobs])
  log(`claim: ${(c.stdout || c.stderr || '').trim()}`)
  // claim may re-merge without our pid — refresh after
  refresh()
}

const deadline = Date.now() + seconds * 1000
let n = 0
while (Date.now() < deadline) {
  n++
  refresh(
    mode === 'judge'
      ? { role: 'judge', judge_scope: scope, judge_at: new Date().toISOString() }
      : {},
  )
  if (mode === 'judge') {
    const summary =
      scope === 'fleet'
        ? 'FLEET live: dogfood workers on dogfood-notes/** + side-repo notes/**'
        : `REPO ${repoId}: live workers overlapping dogfood/notes paths`
    const analysis =
      scope === 'fleet'
        ? 'Fleet keeper sees multi-repo dogfood. Contested surface is shared notes files. Advise workers to narrow claims; surface dual-touch to human. Do not pick winners.'
        : 'Repo keeper: multiple live dogfood workers claim overlapping globs. CLI contested paths are authoritative. Prefer unique wN.md files; serialize shared.md.'
    const payload = JSON.stringify({
      summary,
      analysis,
      confidence: 'high',
      advice: [
        {
          audience: 'workers',
          text: 'If territory shows another LIVE session on your globs, narrow or ask human',
        },
        { audience: 'human', text: 'Dogfood keeper briefs — synthetic collision heat' },
      ],
      inputs: { live: 12, contested: 1, sources: ['keeper'] },
    })
    const p = runSage(['judge', 'publish'], { input: payload })
    log(`publish#${n}: ${(p.stdout || p.stderr || '').trim()}`)
  }
  await new Promise((r) => setTimeout(r, 5000))
}

if (mode === 'judge') {
  runSage(['judge', 'off'])
  log('judge off')
}
log('keeper exit')
process.exit(0)
