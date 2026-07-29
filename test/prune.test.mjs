import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planPrune } from '../lib/prune.mjs'

const iso = (msAgo, now) => new Date(now - msAgo).toISOString()
const DAY = 86_400_000

test('planPrune: removes closed/dead older than threshold, keeps the rest', () => {
  const now = 1_800_000_000_000 // fixed epoch; do not call Date.now() in tests
  const sessions = [
    { session_id: 'a', liveness: 'closed', updated_at: iso(10 * DAY, now) }, // old closed → remove
    { session_id: 'b', liveness: 'dead', updated_at: iso(9 * DAY, now) },    // old dead → remove
    { session_id: 'c', liveness: 'closed', updated_at: iso(2 * DAY, now) },  // recent closed → keep
    { session_id: 'd', liveness: 'working', updated_at: iso(30 * DAY, now) },// live → keep regardless
    { session_id: 'e', liveness: 'stalled', updated_at: iso(30 * DAY, now) },// stalled → keep
  ]
  const { remove, keep } = planPrune(sessions, { days: 7, now })
  assert.deepEqual(remove.map((s) => s.session_id).sort(), ['a', 'b'])
  assert.deepEqual(keep.map((s) => s.session_id).sort(), ['c', 'd', 'e'])
})

test('planPrune: never removes a session missing updated_at', () => {
  const now = 1_800_000_000_000
  const { remove } = planPrune([{ session_id: 'x', liveness: 'dead' }], { days: 7, now })
  assert.equal(remove.length, 0)
})

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pruneAll } from '../lib/prune.mjs'

test('pruneAll reports counts across repos and honours dryRun', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sage-prune-'))
  // build two repo dirs with one old + one fresh session each
  const now = Date.parse('2026-07-29T12:00:00.000Z')
  const old = new Date(now - 40 * 86400_000).toISOString()
  const fresh = new Date(now - 3600_000).toISOString()
  for (const id of ['repo-a1111111', 'repo-b2222222']) {
    const dir = path.join(home, '.claude', 'agentic-sage', 'repos', id, 'sessions')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'old.json'), JSON.stringify({ status: 'closed', updated_at: old }))
    fs.writeFileSync(path.join(dir, 'new.json'), JSON.stringify({ status: 'active', updated_at: fresh }))
  }
  const dry = pruneAll(home, { olderThanDays: 14, dryRun: true, now })
  assert.equal(dry.sessions, 2)
  assert.equal(fs.existsSync(path.join(home, '.claude', 'agentic-sage', 'repos', 'repo-a1111111', 'sessions', 'old.json')), true)
  const real = pruneAll(home, { olderThanDays: 14, now })
  assert.equal(real.sessions, 2)
  assert.equal(fs.existsSync(path.join(home, '.claude', 'agentic-sage', 'repos', 'repo-a1111111', 'sessions', 'old.json')), false)
  assert.equal(fs.existsSync(path.join(home, '.claude', 'agentic-sage', 'repos', 'repo-a1111111', 'sessions', 'new.json')), true)
})
