import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { globalConfig, sageHome, fleetBriefFile, sessionsDir } from '../lib/paths.mjs'
import { atomicWriteJson, mergeRecord } from '../lib/store.mjs'
import {
  readJudgeDesired,
  evaluateJudgeDesire,
  isJudgeDesireSatisfied,
  hasLiveJudgeSession,
  preferredOfflineLine,
  doctorLiveJudgeDetail,
} from '../lib/judge-desired.mjs'
import { DEFAULT_TTL_MS } from '../lib/brief.mjs'

test('readJudgeDesired defaults to optional', () => {
  assert.equal(readJudgeDesired(null).desired, 'optional')
  assert.equal(readJudgeDesired({}).desired, 'optional')
  assert.equal(readJudgeDesired({ judge: { desired: 'preferred' } }).desired, 'preferred')
  assert.equal(readJudgeDesired({ judge: { desired: 'preferred', warnIfOffline: false } }).warnIfOffline, false)
})

test('preferred + empty home → unsatisfied + shouldWarn', () => {
  const home = mkTmp('sage-jd-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), {
    enabled: true,
    judge: { desired: 'preferred' },
  })
  const ev = evaluateJudgeDesire(home)
  assert.equal(ev.desired, 'preferred')
  assert.equal(ev.satisfied, false)
  assert.equal(ev.shouldWarn, true)
  assert.match(doctorLiveJudgeDetail(home), /preferred · offline/)
  assert.match(preferredOfflineLine(), /sage judge run/)
})

test('optional never shouldWarn even when offline', () => {
  const home = mkTmp('sage-jd-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), { enabled: true })
  const ev = evaluateJudgeDesire(home)
  assert.equal(ev.shouldWarn, false)
  assert.match(doctorLiveJudgeDetail(home), /optional/)
})

test('fresh fleet brief satisfies preferred desire', () => {
  const home = mkTmp('sage-jd-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), {
    enabled: true,
    judge: { desired: 'preferred' },
  })
  const now = Date.now()
  const brief = {
    schema: 1,
    kind: 'sage.brief',
    scope: 'fleet',
    judge_sid: 'j1',
    judge_repo_id: 'r1',
    judge_pid: process.pid,
    updated_at: new Date(now).toISOString(),
    status: 'active',
    ttl_ms: DEFAULT_TTL_MS,
    grace_ms: 30_000,
    summary: 'ok',
    analysis: 'test',
    hotspots: [],
    session_lines: [],
    advice: [],
    confidence: 'low',
    inputs: { live: 0, contested: 0, sources: [] },
  }
  fs.mkdirSync(path.dirname(fleetBriefFile(home)), { recursive: true })
  fs.writeFileSync(fleetBriefFile(home), JSON.stringify(brief))
  // Without live judge, grace path can still attach when age small
  assert.equal(isJudgeDesireSatisfied(home, { now }), true)
  assert.equal(evaluateJudgeDesire(home, { now }).shouldWarn, false)
  assert.match(doctorLiveJudgeDetail(home, { now }), /satisfied/)
})

test('warnIfOffline false silences preferred warn', () => {
  const home = mkTmp('sage-jd-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), {
    enabled: true,
    judge: { desired: 'preferred', warnIfOffline: false },
  })
  assert.equal(evaluateJudgeDesire(home).shouldWarn, false)
})

test('live role=judge session satisfies preferred without a brief', () => {
  const home = mkTmp('sage-jd-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), {
    enabled: true,
    judge: { desired: 'preferred' },
  })
  const repoId = 'repo-judge-live'
  mergeRecord(home, repoId, 'judge-live', {
    session_id: 'judge-live',
    repo_id: repoId,
    role: 'judge',
    pid: process.pid,
    status: 'active',
    link_state: 'linked',
    liveness: 'working',
    alive: true,
    updated_at: new Date().toISOString(),
  })
  assert.equal(hasLiveJudgeSession(home), true)
  assert.equal(isJudgeDesireSatisfied(home), true)
  assert.equal(evaluateJudgeDesire(home).shouldWarn, false)
  assert.match(doctorLiveJudgeDetail(home), /preferred · satisfied/)
})

// Regression: preferred-offline probe must not re-merge Agent Status Provider
// records for every repo (that path multiplies resolveRepoId × isAlive cost and
// hung sage gate / SessionStart on machines with 100+ repos + dense agent-status).
test('preferred probe stays bounded with many repos + dense agent-status', () => {
  const home = mkTmp('sage-jd-budget-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), {
    enabled: true,
    judge: { desired: 'preferred' },
  })
  const reposRoot = path.join(sageHome(home), 'repos')
  for (let i = 0; i < 40; i++) {
    const id = `budget-repo-${i}`
    fs.mkdirSync(sessionsDir(home, id), { recursive: true })
    // Empty session dirs still participate in listRepoIds; no judges.
    fs.writeFileSync(path.join(reposRoot, id, '.keep'), '')
  }
  const statusDir = path.join(home, 'agent-status', 'sessions')
  fs.mkdirSync(statusDir, { recursive: true })
  for (let i = 0; i < 200; i++) {
    fs.writeFileSync(
      path.join(statusDir, `child-${i}.json`),
      JSON.stringify({
        pid: 900000 + i,
        cwd: `/tmp/nonexistent-budget-${i}`,
        updated_at: Date.now(),
        started_at: Date.now(),
        ttl_ms: 12 * 3600_000,
        source_cli: 'fixture',
        written_by: 'test',
      }),
    )
  }
  const prev = process.env.AGENT_STATUS_DIR
  process.env.AGENT_STATUS_DIR = path.join(home, 'agent-status')
  try {
    const t0 = Date.now()
    const ev = evaluateJudgeDesire(home)
    const ms = Date.now() - t0
    assert.equal(ev.desired, 'preferred')
    assert.equal(ev.satisfied, false)
    assert.equal(ev.shouldWarn, true)
    // Full synthetic merge per repo would be multi-second; keep a tight budget.
    assert.ok(ms < 1500, `evaluateJudgeDesire took ${ms}ms (expected <1500 with noSynthetic)`)
  } finally {
    if (prev === undefined) delete process.env.AGENT_STATUS_DIR
    else process.env.AGENT_STATUS_DIR = prev
  }
})
