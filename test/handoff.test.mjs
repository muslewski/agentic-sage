import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp, mkGitRepo } from './helpers.mjs'
import {
  sidecarPathFor,
  buildSidecar,
  writeSidecar,
  readSidecar,
  latestSidecar,
  autoDump,
} from '../lib/handoff.mjs'

// --- schema: sidecarPathFor + buildSidecar -------------------------------

test('sidecarPathFor swaps .md for .json', () => {
  assert.equal(sidecarPathFor('/tmp/x-handoff-2026.md'), '/tmp/x-handoff-2026.json')
  assert.equal(sidecarPathFor('/tmp/no-ext'), '/tmp/no-ext.json')
})

test('buildSidecar stamps schema and keeps core', () => {
  const s = buildSidecar({
    session_id: 's1',
    worktree: '/w',
    branch: 'b',
    head: 'h',
    dirty: true,
    touched_globs: ['a'],
    handoff_at: 'T',
    source: 'manual',
    md_path: '/m.md',
  })
  assert.equal(s.schema, 'sage.handoff/1')
  assert.equal(s.session_id, 's1')
  assert.equal(s.source, 'manual')
  assert.deepEqual(s.touched_globs, ['a'])
})

test('buildSidecar omits empty optionals', () => {
  const s = buildSidecar({ session_id: 's1', worktree: '/w', project: {}, suggested_skills: [] })
  assert.ok(!('state_summary' in s))
  assert.ok(!('project' in s))
  assert.ok(!('suggested_skills' in s))
})

test('buildSidecar keeps non-empty optionals', () => {
  const s = buildSidecar({
    session_id: 's1',
    state_summary: 'mid',
    project: { backlog_row: 'D8' },
  })
  assert.equal(s.state_summary, 'mid')
  assert.deepEqual(s.project, { backlog_row: 'D8' })
})

// --- write / read --------------------------------------------------------

test('writeSidecar + readSidecar roundtrip, no tmp left behind', () => {
  const dir = mkTmp('sage-ho-')
  const p = path.join(dir, 'x-handoff.json')
  writeSidecar(p, buildSidecar({ session_id: 's1', worktree: '/w', source: 'manual' }))
  assert.equal(readSidecar(p).session_id, 's1')
  assert.ok(!fs.readdirSync(dir).some((f) => f.includes('.tmp.')))
})

test('readSidecar returns null for absent and malformed', () => {
  const dir = mkTmp('sage-ho-')
  assert.equal(readSidecar(path.join(dir, 'nope.json')), null)
  const bad = path.join(dir, 'bad.json')
  fs.writeFileSync(bad, '{ not json,, }')
  assert.equal(readSidecar(bad), null)
})

// --- latestSidecar -------------------------------------------------------

test('latestSidecar returns the newest for the queried worktree', () => {
  const dir = mkTmp('sage-ho-')
  writeSidecar(
    path.join(dir, 'a.json'),
    buildSidecar({ session_id: 'a', worktree: '/w1', handoff_at: '2026-06-28T10:00:00.000Z' }),
  )
  writeSidecar(
    path.join(dir, 'b.json'),
    buildSidecar({ session_id: 'b', worktree: '/w1', handoff_at: '2026-06-28T12:00:00.000Z' }),
  )
  writeSidecar(
    path.join(dir, 'c.json'),
    buildSidecar({ session_id: 'c', worktree: '/other', handoff_at: '2026-06-28T13:00:00.000Z' }),
  )
  const hit = latestSidecar(dir, { worktree: '/w1' })
  assert.equal(hit.sidecar.session_id, 'b') // newest among /w1, ignores /other
})

test('latestSidecar returns null on empty dir', () => {
  assert.equal(latestSidecar(mkTmp('sage-ho-'), { worktree: '/w' }), null)
})

// --- autoDump ------------------------------------------------------------

test('autoDump writes thin md + json sidecar with objective core', () => {
  const repo = mkGitRepo()
  const tmpDir = mkTmp('sage-dump-')
  const { mdPath, jsonPath, sidecar } = autoDump({
    cwd: repo,
    sessionId: 's1',
    pid: 999,
    now: 1719576000000,
    tmpDir,
    prefix: 'proj',
  })
  assert.ok(fs.existsSync(mdPath))
  assert.ok(fs.existsSync(jsonPath))
  assert.equal(sidecar.schema, 'sage.handoff/1')
  assert.equal(sidecar.source, 'precompact')
  assert.equal(sidecar.branch, 'main')
  assert.match(sidecar.head, /^[0-9a-f]{40}$/)
  assert.equal(sidecar.worktree, repo)
  assert.equal(sidecar.md_path, mdPath)
  assert.ok(!('state_summary' in sidecar)) // hook has no conversation access
})
