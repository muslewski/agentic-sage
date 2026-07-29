// test/rollup.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { rollupSessions } from '../lib/rollup.mjs'

const mk = (n, extra) =>
  Array.from({ length: n }, (_, i) => ({
    session_id: `s${i}`,
    pid: 1000 + i,
    liveness: 'working',
    synthetic: true,
    ...extra,
  }))

test('under budget, rollup is the identity', () => {
  const rows = mk(5, { lane: 'armory' })
  const out = rollupSessions(rows, { budget: 12 })
  assert.equal(out.rows.length, 5)
  assert.equal(out.groups.length, 0)
})

test('over budget, rows sharing a lane collapse to one group row', () => {
  const rows = mk(40, { lane: 'armory' })
  const out = rollupSessions(rows, { budget: 12 })
  assert.equal(out.groups.length, 1)
  assert.equal(out.groups[0].kind, 'lane')
  assert.equal(out.groups[0].key, 'armory')
  assert.equal(out.groups[0].count, 40)
  assert.equal(out.groups[0].live, 40)
})

test('rows with no groupable key are never collapsed', () => {
  const rows = [...mk(40, { lane: 'armory' }), { session_id: 'human', pid: 9, liveness: 'idle' }]
  const out = rollupSessions(rows, { budget: 12 })
  assert.equal(out.rows.length, 1)
  assert.equal(out.rows[0].session_id, 'human')
})

test('lane beats parent_sid when both are present', () => {
  const out = rollupSessions(mk(40, { lane: 'armory', parent_sid: 'q1' }), { budget: 12 })
  assert.equal(out.groups[0].kind, 'lane')
})

test('dead and live are counted separately in a group', () => {
  const rows = [...mk(20, { lane: 'a' }), ...mk(20, { lane: 'a', liveness: 'dead' })]
  const out = rollupSessions(rows, { budget: 12 })
  assert.equal(out.groups[0].count, 40)
  assert.equal(out.groups[0].live, 20)
  assert.equal(out.groups[0].dead, 20)
})

test('a group of one is left as a plain row, not a group of one', () => {
  const rows = [...mk(30, { lane: 'big' }), { session_id: 'solo', pid: 7, lane: 'tiny', liveness: 'working' }]
  const out = rollupSessions(rows, { budget: 12 })
  assert.equal(out.groups.length, 1)
  assert.equal(out.rows.find((r) => r.session_id === 'solo') !== undefined, true)
})
