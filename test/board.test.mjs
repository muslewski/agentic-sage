import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { sessionsDir } from '../lib/paths.mjs'
import { handoffBucket, collectSessions, renderBoard, spinnerize } from '../lib/board.mjs'
import { startTimeOf } from '../lib/tmux.mjs'
import { SPINNER_FRAMES } from '../lib/spinner.mjs'

const seed = (home, repoId, sid, rec) => {
  const dir = sessionsDir(home, repoId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${sid}.json`), JSON.stringify({ session_id: sid, ...rec }))
}
const NOW = Date.parse('2026-06-28T12:00:00.000Z')
const ago = (ms) => new Date(NOW - ms).toISOString()
const H = 3600000

test('handoffBucket buckets by age', () => {
  assert.equal(handoffBucket(null, NOW).bucket, 'none')
  assert.equal(handoffBucket(ago(1 * H), NOW).bucket, 'fresh')
  assert.equal(handoffBucket(ago(4 * H), NOW).bucket, 'aging')
  assert.equal(handoffBucket(ago(20 * H), NOW).bucket, 'stale')
})

test('collectSessions enriches liveness + sorts newest-first; dead pid → dead', () => {
  const home = mkTmp('sage-b-')
  const id = 'repo-aaaa1111'
  seed(home, id, 'old', { branch: 'a', updated_at: ago(10 * H), last_tool_at: ago(10 * H) })
  seed(home, id, 'dead', { branch: 'b', pid: 2147483646, updated_at: ago(1 * H) })
  const out = collectSessions(home, id, NOW)
  assert.equal(out[0].session_id, 'dead') // newest updated_at first
  assert.equal(out.find((s) => s.session_id === 'dead').liveness, 'dead')
})

test('collectSessions: missing repo → []', () => {
  assert.deepEqual(collectSessions(mkTmp('sage-b-'), 'nope-0000', NOW), [])
})

test('renderBoard shows branches + bucket; empty → no sessions', () => {
  const home = mkTmp('sage-b-')
  const id = 'repo-bbbb2222'
  seed(home, id, 's1', { branch: 'feat-x', dirty: true, touched_globs: ['a.ts'], handoff_at: ago(1 * H) })
  const txt = renderBoard(collectSessions(home, id, NOW), { repoId: id, now: NOW })
  assert.match(txt, /feat-x/)
  assert.match(txt, /fresh/)
  assert.match(renderBoard([], { repoId: id, now: NOW }), /no sessions/)
})

test('renderBoard is branch-led with zone + ✎ + balanced header; UUID hidden', () => {
  const sessions = [
    { session_id: 'uuid-aaaa1111', branch: 'feat/auth', liveness: 'active', dirty: true,
      touched_globs: ['src/auth/x.ts', 'src/auth/y.ts'], handoff_bucket: 'fresh', handoff_age: '8m ago',
      ctx_used: 62, ctx_window: 100 },
  ]
  const txt = renderBoard(sessions, { repoId: 'repo' })
  assert.match(txt, /^SAGE · repo · 1 session\n/) // singular, no "board"
  assert.match(txt, /feat\/auth ✎/) // branch identity + uncommitted marker
  assert.match(txt, /src\/auth\//) // zone = where they work
  assert.match(txt, /active · 62%/) // status carries ctx
  assert.ok(!txt.includes('uuid-aaaa1111')) // UUID hidden by default
})

test('renderBoard flags an orphan (dead holds a row); --wide reveals the sid', () => {
  const sessions = [
    { session_id: 'deadbeef-9999', branch: 'feat/x', liveness: 'dead', row: 'M3',
      handoff_bucket: 'stale', handoff_age: '3h ago', touched_globs: ['data/loader.py'] },
  ]
  const plain = renderBoard(sessions, { repoId: 'repo' })
  assert.match(plain, /↳M3 ⚠/)
  assert.ok(!plain.includes('deadbeef'))
  assert.match(renderBoard(sessions, { repoId: 'repo', wide: true }), /deadbeef/) // reachable for link/unlink
})

test('spinnerize swaps the ● of working rows only; header + idle untouched', () => {
  const sessions = [
    { branch: 'feat/a', liveness: 'working', touched_globs: ['src/a.ts'] },
    { branch: 'feat/b', liveness: 'idle', touched_globs: ['src/b.ts'] },
  ]
  const text = renderBoard(sessions, { repoId: 'repo' })
  const frame = SPINNER_FRAMES[0]
  const out = spinnerize(text, sessions, frame).split('\n')
  assert.ok(out[0].startsWith('SAGE ·')) // header untouched
  assert.equal(out[1], '') // blank line untouched
  assert.ok(out[2].startsWith(`${frame} feat/a`)) // active row leads with the frame
  assert.ok(out[3].startsWith('● feat/b')) // idle row keeps its static ●
})

test('spinnerize leaves an empty board untouched', () => {
  const text = renderBoard([], { repoId: 'repo' })
  assert.equal(spinnerize(text, [], SPINNER_FRAMES[0]), text)
})

test('collectSessions: backfills session_id from filename when body omits it', () => {
  const home = mkTmp()
  const repoId = 'demo-repo-1234abcd'
  const dir = sessionsDir(home, repoId)
  fs.mkdirSync(dir, { recursive: true })
  // id-less body, exactly like the real legacy records (keys: link_state,status,liveness,updated_at)
  fs.writeFileSync(
    path.join(dir, 'ghost-sid-1.json'),
    JSON.stringify({ link_state: 'closed', status: 'closed', liveness: 'closed', updated_at: new Date().toISOString() }),
  )
  const out = collectSessions(home, repoId, Date.now())
  assert.equal(out.length, 1)
  assert.equal(out[0].session_id, 'ghost-sid-1', 'sid backfilled from filename')
})

test('pid-less non-closed record → dead (honest liveness)', () => {
  const home = mkTmp('sage-b-')
  const id = 'repo-cccc3333'
  // no pid, recent tool activity — the old default read this alive/working
  seed(home, id, 'ghost', { branch: 'main', updated_at: ago(1000), last_tool_at: ago(1000) })
  const out = collectSessions(home, id, NOW)
  assert.equal(out[0].liveness, 'dead')
})

test('collectSessions: pid_start match → alive, mismatch → dead (recycle-proof)', () => {
  const home = mkTmp('sage-b-')
  const id = 'repo-dddd4444'
  const realStart = startTimeOf(process.pid) // '' on a non-/proc platform
  // matching start-time + recent activity → not dead (Linux: working;
  // non-/proc: realStart '' opts out → plain probe → alive)
  seed(home, id, 'match', {
    branch: 'a', pid: process.pid, pid_start: realStart,
    last_tool_at: ago(1000), updated_at: ago(1000),
  })
  // a WRONG start-time means the pid was recycled → dead, even though pid is live
  seed(home, id, 'recycled', {
    branch: 'b', pid: process.pid, pid_start: '1', updated_at: ago(2000),
  })
  const out = collectSessions(home, id, NOW)
  assert.notEqual(out.find((s) => s.session_id === 'match').liveness, 'dead')
  assert.equal(out.find((s) => s.session_id === 'recycled').liveness, 'dead')
})
