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
