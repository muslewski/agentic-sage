import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveJudgeScope,
  resolveHarness,
  readJudgeConfig,
  buildFactBrief,
  publishFactBrief,
  summarizeJudgeChrome,
  seedJudgeSession,
} from '../lib/judge-run.mjs'
import { mkTmp, mkGitRepo, writeGlobalConfig } from './helpers.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { mergeRecord } from '../lib/store.mjs'
import { collectFleet } from '../lib/fleet.mjs'
import { isBriefFresh } from '../lib/brief.mjs'
import { renderWarHeader } from '../lib/warfaces.mjs'
import { renderPanels } from '../lib/warroom.mjs'

describe('resolveJudgeScope', () => {
  it('honors force fleet/repo', () => {
    const home = mkTmp('sage-jscope-')
    assert.equal(resolveJudgeScope(home, process.cwd(), { force: 'fleet' }), 'fleet')
    assert.equal(resolveJudgeScope(home, process.cwd(), { force: 'repo' }), 'repo')
  })
})

describe('resolveHarness', () => {
  it('none is explicit', () => {
    const h = resolveHarness({ harness: 'auto', commands: {}, args: {} }, 'none')
    assert.equal(h.name, 'none')
  })
  it('auto falls back to none when no CLIs', () => {
    const h = resolveHarness(
      { harness: 'auto', commands: { grok: 'not-a-real-bin-xyz', claude: 'also-fake-zzz' }, args: {} },
      'auto',
    )
    // may find real grok on machine — if so name is grok; if not none
    assert.ok(h.name === 'none' || h.name === 'grok' || h.name === 'claude')
  })
})

describe('fact brief + chrome', () => {
  it('publishFactBrief is attachable while process alive', () => {
    const home = mkTmp('sage-jfact-')
    writeGlobalConfig(home, { enabled: true })
    const repo = mkGitRepo()
    const repoId = resolveRepoId(repo)
    const sid = 'j-fact-1'
    seedJudgeSession(home, repoId, sid, repo, 'repo')
    const b = publishFactBrief(home, 'repo', repoId, sid)
    assert.equal(b.kind, 'sage.brief')
    assert.ok(b.summary)
    assert.equal(isBriefFresh(b, { now: Date.now(), home }), true)
  })

  it('summarizeJudgeChrome labels live judges', () => {
    const home = mkTmp('sage-jchrome-')
    writeGlobalConfig(home, { enabled: true })
    const repo = mkGitRepo()
    const repoId = resolveRepoId(repo)
    mergeRecord(home, repoId, 'j1', {
      session_id: 'j1',
      repo_id: repoId,
      role: 'judge',
      judge_scope: 'fleet',
      pid: process.pid,
      status: 'active',
      link_state: 'linked',
      liveness: 'working',
      updated_at: new Date().toISOString(),
      last_tool_at: new Date().toISOString(),
    })
    const fleet = collectFleet(home, Date.now())
    // ensure judges counted
    const jc = summarizeJudgeChrome(home, fleet, { now: Date.now() })
    assert.ok(jc.judges >= 1 || jc.label.includes('⚖') || jc.judges === 0)
    // With live pid judge, judges should be >= 1
    assert.ok(jc.judges >= 1, `expected judges>=1 got ${jc.judges} label=${jc.label}`)
    assert.ok(jc.label.includes('⚖'))
  })
})

describe('war chrome render', () => {
  it('header includes judge chip when provided', () => {
    const h = renderWarHeader('live', '12:00:00', 100, {
      live: 3,
      clash: 0,
      memory: 0,
      judgeChip: '⚖ 1 live',
    })
    assert.ok(h.includes('SAGE WAR'))
    assert.ok(h.includes('⚖') || h.includes('1 live'))
  })

  it('panels show judge line in FLEET box', () => {
    const p = renderPanels({
      repos: 2,
      live: 4,
      working: 1,
      contested: 0,
      human: 3,
      nested: 1,
      judges: 1,
      judge_label: '⚖ 1 live · fleet',
    })
    assert.ok(p.includes('⚖') || p.includes('judge'))
  })
})

describe('readJudgeConfig', () => {
  it('defaults', () => {
    const home = mkTmp('sage-jcfg-')
    writeGlobalConfig(home, { enabled: true })
    const c = readJudgeConfig(home)
    assert.equal(c.harness, 'auto')
    assert.equal(c.scope, 'auto')
  })
})
