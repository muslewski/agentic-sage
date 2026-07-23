import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkTmp, mkGitRepo, writeGlobalConfig } from './helpers.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { mergeRecord } from '../lib/store.mjs'
import { territory, mergeBrief } from '../lib/territory.mjs'
import { contestedCount, fleetLine } from '../lib/fleet.mjs'
import { contestedPaths } from '../lib/warfaces.mjs'
import { repoBriefFile, fleetBriefFile, normalizeBrief, writeBriefFile } from '../lib/brief.mjs'

const sage = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'sage')

const run = (args, { home, cwd, env = {}, input } = {}) => {
  try {
    return execFileSync(process.execPath, [sage, ...args], {
      encoding: 'utf8',
      cwd,
      env: { ...process.env, HOME: home, SAGE_SELF_SID: env.SAGE_SELF_SID || process.env.SAGE_SELF_SID, ...env },
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    const err = new Error(e.stderr || e.stdout || e.message)
    err.stdout = e.stdout
    err.stderr = e.stderr
    err.status = e.status
    throw err
  }
}

const seedSession = (home, repoId, sid, patch = {}) => {
  mergeRecord(home, repoId, sid, {
    session_id: sid,
    repo_id: repoId,
    pid: process.pid,
    status: 'active',
    link_state: 'linked',
    liveness: 'working',
    branch: 'feat/x',
    touched_globs: ['src/a.ts'],
    updated_at: new Date().toISOString(),
    last_tool_at: new Date().toISOString(),
    ...patch,
  })
}

describe('judge role excludes collision peers', () => {
  it('territory / mergeBrief / contested ignore judges', () => {
    const home = mkTmp('sage-judge-terr-')
    writeGlobalConfig(home, { enabled: true })
    const repo = mkGitRepo()
    const repoId = resolveRepoId(repo)
    seedSession(home, repoId, 'worker-a', {
      branch: 'a',
      touched_globs: ['src/a.ts'],
      claimed_globs: ['src/**'],
    })
    seedSession(home, repoId, 'judge-1', {
      role: 'judge',
      judge_scope: 'repo',
      branch: 'judge',
      touched_globs: ['src/a.ts'],
      claimed_globs: ['src/**'],
    })
    seedSession(home, repoId, 'worker-b', {
      branch: 'b',
      touched_globs: ['src/a.ts'],
    })

    const hits = territory(home, repoId, ['src/**'], { selfSid: 'caller' })
    assert.ok(hits.every((h) => h.session_id !== 'judge-1'))
    assert.ok(hits.some((h) => h.session_id === 'worker-a'))

    const contested = mergeBrief(home, repoId, { selfSid: 'caller' })
    for (const c of contested) {
      assert.ok(c.sessions.every((s) => s.session_id !== 'judge-1'))
    }

    const rows = [
      { session_id: 'worker-a', liveness: 'working', touched_globs: ['src/a.ts'] },
      { session_id: 'judge-1', liveness: 'working', role: 'judge', touched_globs: ['src/a.ts'] },
      { session_id: 'worker-b', liveness: 'working', touched_globs: ['src/a.ts'] },
    ]
    assert.equal(contestedCount(rows), 1) // path a.ts with 2 workers
    const paths = contestedPaths(rows)
    assert.equal(paths.length, 1)
    assert.equal(paths[0].sessions.length, 2)

    const line = fleetLine(rows, { selfSid: 'x' })
    assert.ok(!line.includes('judge'))
  })
})

describe('sage judge CLI', () => {
  it('on / publish / attach / off', () => {
    const home = mkTmp('sage-judge-cli-')
    writeGlobalConfig(home, { enabled: true })
    const repo = mkGitRepo()
    const repoId = resolveRepoId(repo)
    const sid = 'judge-cli-sid'
    seedSession(home, repoId, sid, { role: '', branch: 'main' })

    const onOut = run(['judge', 'on', '--repo'], {
      home,
      cwd: repo,
      env: { SAGE_SELF_SID: sid, HOME: home },
    })
    assert.match(onOut, /judge online \(repo\)/)

    const pub = run(['judge', 'publish'], {
      home,
      cwd: repo,
      env: { SAGE_SELF_SID: sid, HOME: home },
      input: JSON.stringify({
        summary: 'two live on src',
        analysis: 'Worker A and B both touch src — surface to human.',
        confidence: 'high',
        advice: [{ audience: 'workers', text: 'Narrow claims before editing.' }],
      }),
    })
    assert.match(pub, /published repo brief/)
    assert.ok(fs.existsSync(repoBriefFile(home, repoId)))

    // worker consult sees layered brief
    const terr = run(['territory', 'src/**'], {
      home,
      cwd: repo,
      env: { HOME: home, SAGE_SELF_SID: 'other' },
    })
    assert.match(terr, /live judge · repo/)
    assert.match(terr, /two live on src/)

    const noB = run(['territory', 'src/**', '--no-brief'], {
      home,
      cwd: repo,
      env: { HOME: home },
    })
    assert.ok(!noB.includes('live judge'))

    const fleetJson = run(['fleet', '--json'], {
      home,
      cwd: repo,
      env: { HOME: home },
    })
    const env = JSON.parse(fleetJson)
    assert.equal(env.schema, 1)
    assert.ok(env.briefs)
    assert.equal(env.briefs.repo.summary, 'two live on src')

    // claim blocked for judge (advisory exit 0 + message)
    const claimOut = run(['claim', 'src/**'], {
      home,
      cwd: repo,
      env: { SAGE_SELF_SID: sid, HOME: home },
    })
    assert.match(claimOut, /judge sessions do not claim/)

    const off = run(['judge', 'off'], {
      home,
      cwd: repo,
      env: { SAGE_SELF_SID: sid, HOME: home },
    })
    assert.match(off, /judge offline/)
  })

  it('slot exclusivity without takeover', () => {
    const home = mkTmp('sage-judge-slot-')
    writeGlobalConfig(home, { enabled: true })
    const repo = mkGitRepo()
    const repoId = resolveRepoId(repo)
    seedSession(home, repoId, 'j-a', { role: 'judge', judge_scope: 'fleet' })
    writeBriefFile(
      fleetBriefFile(home),
      normalizeBrief({
        scope: 'fleet',
        summary: 'held',
        analysis: 'x',
        judge_sid: 'j-a',
        judge_repo_id: repoId,
        judge_pid: process.pid,
        status: 'active',
      }),
    )
    seedSession(home, repoId, 'j-b', {})

    const held = run(['judge', 'on', '--fleet'], {
      home,
      cwd: repo,
      env: { SAGE_SELF_SID: 'j-b', HOME: home },
    })
    assert.match(held, /slot held/)

    const take = run(['judge', 'on', '--fleet', '--takeover'], {
      home,
      cwd: repo,
      env: { SAGE_SELF_SID: 'j-b', HOME: home },
    })
    assert.match(take, /judge online \(fleet\)/)
  })
})
