import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { globalConfig, sageHome, fleetBriefFile, sessionsDir } from '../lib/paths.mjs'
import { atomicWriteJson } from '../lib/store.mjs'
import {
  readJudgeDesired,
  evaluateJudgeDesire,
  isJudgeDesireSatisfied,
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
