import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { sessionFile, eventsFile, sageHome, sessionsDir } from '../lib/paths.mjs'
import { readSidecar } from '../lib/handoff.mjs'
import { mkTmp, mkGitRepo, writeGlobalConfig } from './helpers.mjs'

const EMIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'sage-emit.mjs')

const emit = (payload, home) =>
  execFileSync('node', [EMIT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  })

test('SessionStart writes a scoping record; Stop refreshes + logs both events', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)

  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  const rec1 = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.equal(rec1.link_state, 'scoping')
  assert.equal(rec1.repo_id, id)
  assert.equal(rec1.source, 'startup')
  assert.match(rec1.head, /^[0-9a-f]{40}$/)

  emit({ hook_event_name: 'Stop', session_id: 's1', cwd: repo }, home)
  const events = fs.readFileSync(eventsFile(home, id), 'utf8').split('\n').filter(Boolean)
  assert.deepEqual(events.map((l) => JSON.parse(l).event), ['open', 'stop'])
  const rec2 = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.ok(rec2.updated_at)
})

test('DEFAULT-OFF: no global config ⇒ nothing written', () => {
  const home = mkTmp('sage-h-') // no config seeded
  const repo = mkGitRepo()
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  assert.equal(fs.existsSync(path.join(sageHome(home), 'repos')), false)
})

test('fail-open: malformed stdin exits 0 (does not throw)', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  assert.doesNotThrow(() =>
    execFileSync('node', [EMIT], {
      input: 'not json',
      encoding: 'utf8',
      env: { ...process.env, HOME: home },
    }),
  )
})

test('non-git cwd ⇒ nothing written', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const notRepo = mkTmp('sage-norepo-')
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: notRepo }, home)
  assert.equal(fs.existsSync(path.join(sageHome(home), 'repos')), false)
})

test('PreCompact auto-dumps md+json and stamps the record', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  const tmpDir = mkTmp('sage-dump-')
  execFileSync('node', [EMIT], {
    input: JSON.stringify({ hook_event_name: 'PreCompact', session_id: 's1', cwd: repo }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home, SAGE_TMPDIR: tmpDir },
  })
  const jsons = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.json'))
  assert.equal(jsons.length, 1)
  const sc = readSidecar(path.join(tmpDir, jsons[0]))
  assert.equal(sc.source, 'precompact')
  const rec = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.ok(rec.handoff_path)
  assert.ok(rec.handoff_at)
  const events = fs.readFileSync(eventsFile(home, id), 'utf8').split('\n').filter(Boolean)
  assert.ok(events.map((l) => JSON.parse(l).event).includes('precompact'))
})

const seedOther = (home, id, rec) => {
  fs.mkdirSync(sessionsDir(home, id), { recursive: true })
  fs.writeFileSync(path.join(sessionsDir(home, id), `${rec.session_id}.json`), JSON.stringify(rec))
}

test('SessionStart brief: prints a one-liner when another session exists', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedOther(home, id, { session_id: 'other', branch: 'feat-other', touched_globs: ['src/x.ts'], liveness: 'idle', updated_at: '2026-06-28T12:00:00Z' })
  const out = emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  assert.match(out, /sage: \d+ live · nearest feat-other touches src\/x\.ts/)
})

test('SessionStart brief: silent when solo, when disabled, and on non-SessionStart events', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  // solo → no other session → no brief
  assert.equal(emit({ hook_event_name: 'SessionStart', session_id: 'solo', cwd: repo }, home).trim(), '')
  // a Stop with another session present → still no brief (SessionStart-only)
  seedOther(home, id, { session_id: 'other', branch: 'feat-other', touched_globs: ['src/x.ts'], liveness: 'idle', updated_at: '2026-06-28T12:00:00Z' })
  assert.equal(emit({ hook_event_name: 'Stop', session_id: 'solo', cwd: repo }, home).trim(), '')
  // disabled → no brief even on SessionStart with another session present
  const home2 = mkTmp('sage-h-') // no config seeded = disabled
  const repo2 = mkGitRepo()
  seedOther(home2, resolveRepoId(repo2), { session_id: 'other', branch: 'feat-o', touched_globs: ['a.ts'], liveness: 'idle', updated_at: '2026-06-28T12:00:00Z' })
  assert.equal(emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo2 }, home2).trim(), '')
})

test('PreCompact on a non-repo cwd writes nothing and does not throw', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const notRepo = mkTmp('sage-norepo-')
  const tmpDir = mkTmp('sage-dump-')
  assert.doesNotThrow(() =>
    execFileSync('node', [EMIT], {
      input: JSON.stringify({ hook_event_name: 'PreCompact', session_id: 's1', cwd: notRepo }),
      encoding: 'utf8',
      env: { ...process.env, HOME: home, SAGE_TMPDIR: tmpDir },
    }),
  )
  assert.equal(fs.readdirSync(tmpDir).length, 0)
})
