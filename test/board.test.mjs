import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { sessionsDir } from '../lib/paths.mjs'
import { handoffBucket, collectSessions, renderBoard } from '../lib/board.mjs'

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
