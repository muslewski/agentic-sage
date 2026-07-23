import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeBrief,
  writeBriefFile,
  readBriefFile,
  isBriefFresh,
  isBriefInGrace,
  isJudge,
  loadAttachableBriefs,
  attachBriefText,
  renderBriefLayers,
  markBriefStale,
  slotHolder,
  DEFAULT_TTL_MS,
  DEFAULT_GRACE_MS,
  fleetBriefFile,
  repoBriefFile,
} from '../lib/brief.mjs'
import { mergeRecord } from '../lib/store.mjs'
import { mkTmp, writeGlobalConfig, mkGitRepo } from './helpers.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'

describe('brief normalize + IO', () => {
  it('caps analysis and sets schema', () => {
    const b = normalizeBrief({
      scope: 'repo',
      summary: 'hi',
      analysis: 'x'.repeat(10_000),
      confidence: 'nope',
    })
    assert.equal(b.schema, 1)
    assert.equal(b.kind, 'sage.brief')
    assert.equal(b.confidence, 'medium')
    assert.ok(b.analysis.length <= 8001)
    assert.ok(b.analysis.endsWith('…'))
  })

  it('atomic write + read round-trip', () => {
    const home = mkTmp('sage-brief-')
    writeGlobalConfig(home, { enabled: true })
    const file = fleetBriefFile(home)
    const brief = normalizeBrief({
      scope: 'fleet',
      summary: 'desk quiet',
      analysis: 'one live worker',
      judge_sid: 'j1',
      judge_repo_id: 'r1',
      status: 'active',
    })
    writeBriefFile(file, brief)
    const got = readBriefFile(file)
    assert.equal(got.summary, 'desk quiet')
    assert.equal(got.scope, 'fleet')
  })
})

describe('freshness', () => {
  it('stale when TTL exceeded', () => {
    const now = Date.now()
    const b = normalizeBrief({
      scope: 'fleet',
      summary: 'x',
      updated_at: new Date(now - DEFAULT_TTL_MS - 1).toISOString(),
      status: 'active',
      ttl_ms: DEFAULT_TTL_MS,
      judge_sid: 'j',
      judge_repo_id: 'r',
    })
    // without home, only time check
    assert.equal(isBriefFresh(b, { now }), false)
  })

  it('fresh when within TTL and no home check', () => {
    const now = Date.now()
    const b = normalizeBrief({
      scope: 'fleet',
      summary: 'x',
      updated_at: new Date(now).toISOString(),
      status: 'active',
      judge_sid: 'j',
      judge_repo_id: 'r',
    })
    assert.equal(isBriefFresh(b, { now }), true)
  })

  it('live judge within TTL is fresh; dead judge uses grace window', () => {
    const home = mkTmp('sage-brief-live-')
    writeGlobalConfig(home, { enabled: true })
    const repo = mkGitRepo()
    const repoId = resolveRepoId(repo)
    const sid = 'judge-sid-1'
    mergeRecord(home, repoId, sid, {
      session_id: sid,
      repo_id: repoId,
      role: 'judge',
      judge_scope: 'repo',
      pid: process.pid,
      status: 'active',
      link_state: 'linked',
      updated_at: new Date().toISOString(),
    })
    const now = Date.now()
    const brief = normalizeBrief({
      scope: 'repo',
      repo_id: repoId,
      summary: 'hot',
      analysis: 'two on src/',
      judge_sid: sid,
      judge_repo_id: repoId,
      judge_pid: process.pid,
      status: 'active',
      updated_at: new Date(now).toISOString(),
    })
    writeBriefFile(repoBriefFile(home, repoId), brief)
    assert.equal(isBriefFresh(brief, { now, home }), true)
    assert.equal(isBriefInGrace(brief, { now, home }), false)

    // Clear role → not live, but within DEFAULT_GRACE_MS still attachable.
    mergeRecord(home, repoId, sid, { role: '' })
    assert.equal(isBriefFresh(brief, { now, home }), true)
    assert.equal(isBriefInGrace(brief, { now, home }), true)

    // Past grace → not fresh.
    assert.equal(
      isBriefFresh(brief, { now: now + DEFAULT_GRACE_MS + 1, home }),
      false,
    )
  })

  it('slotHolder ignores grace-only (dead) briefs', () => {
    const home = mkTmp('sage-brief-slot-')
    writeGlobalConfig(home, { enabled: true })
    const repo = mkGitRepo()
    const repoId = resolveRepoId(repo)
    const sid = 'dead-judge'
    mergeRecord(home, repoId, sid, {
      session_id: sid,
      repo_id: repoId,
      role: 'judge',
      pid: 2147483646, // almost surely dead
      status: 'active',
      link_state: 'linked',
      updated_at: new Date().toISOString(),
    })
    const brief = normalizeBrief({
      scope: 'repo',
      repo_id: repoId,
      summary: 'held',
      analysis: 'x',
      judge_sid: sid,
      judge_repo_id: repoId,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    writeBriefFile(repoBriefFile(home, repoId), brief)
    // Attach still possible via grace:
    assert.equal(isBriefFresh(brief, { now: Date.now(), home }), true)
    // But slot is free for a new judge:
    assert.equal(slotHolder(home, 'repo', repoId), null)
  })
})

describe('attach layers', () => {
  it('orders repo then fleet', () => {
    const text = renderBriefLayers({
      repo: normalizeBrief({ scope: 'repo', summary: 'REPO', analysis: 'r' }),
      fleet: normalizeBrief({ scope: 'fleet', summary: 'FLEET', analysis: 'f' }),
    })
    assert.ok(text.indexOf('repo') < text.indexOf('fleet'))
    assert.ok(text.includes('REPO'))
    assert.ok(text.includes('FLEET'))
  })

  it('attachBriefText leaves facts alone when no briefs', () => {
    assert.equal(attachBriefText('FACTS', { repo: null, fleet: null }), 'FACTS')
  })

  it('loadAttachableBriefs respects --no-brief', () => {
    const home = mkTmp('sage-brief-nb-')
    const got = loadAttachableBriefs(home, 'x', { noBrief: true })
    assert.deepEqual(got, { repo: null, fleet: null })
  })

  it('markBriefStale flips status', () => {
    const home = mkTmp('sage-brief-stale-')
    writeGlobalConfig(home, { enabled: true })
    const file = fleetBriefFile(home)
    writeBriefFile(
      file,
      normalizeBrief({ scope: 'fleet', summary: 'x', status: 'active', judge_sid: 'j', judge_repo_id: 'r' }),
    )
    assert.equal(markBriefStale(home, 'fleet', null), true)
    assert.equal(readBriefFile(file).status, 'stale')
  })
})

describe('isJudge', () => {
  it('detects role', () => {
    assert.equal(isJudge({ role: 'judge' }), true)
    assert.equal(isJudge({ role: '' }), false)
    assert.equal(isJudge({}), false)
  })
})
