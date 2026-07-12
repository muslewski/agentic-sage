import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAlive, deriveLiveness } from '../lib/liveness.mjs'

test('isAlive: own pid alive, free/invalid pids not', () => {
  assert.equal(isAlive(process.pid), true)
  assert.equal(isAlive(2147483646), false)
  assert.equal(isAlive(0), false)
  assert.equal(isAlive(-1), false)
  assert.equal(isAlive(null), false)
})

test('deriveLiveness enum mapping (keys on alive/closed/lastToolAt recency)', () => {
  const now = 1_000_000_000_000
  assert.equal(deriveLiveness({ closed: true }), 'closed')
  assert.equal(deriveLiveness({ alive: false }), 'dead')
  assert.equal(deriveLiveness({ alive: true, lastToolAt: now, now }), 'working')
  assert.equal(deriveLiveness({ alive: true, lastToolAt: now - 700000, now }), 'stalled')
  assert.equal(deriveLiveness({ alive: true, lastToolAt: new Date(now).toISOString(), now }), 'working')
  assert.equal(deriveLiveness({ alive: true }), 'idle')
  assert.equal(deriveLiveness({}), 'idle')
})

test('isAlive: captured start-time is recycle-proof (match alive, mismatch/gone dead)', () => {
  const opts = (st) => ({ startTime: 'S1', startTimeOf: () => st })
  assert.equal(isAlive(1234, opts('S1')), true)  // same process still there
  assert.equal(isAlive(1234, opts('S2')), false) // pid recycled → new starttime
  assert.equal(isAlive(1234, opts('')), false)   // pid gone → unreadable stat
})

test('isAlive: empty captured start-time opts out → falls back to probe', () => {
  // '' is falsy, so the start-time branch is skipped and the real pid is probed.
  assert.equal(isAlive(process.pid, { startTime: '', startTimeOf: () => 'x' }), true)
  assert.equal(isAlive(2147483646, { startTime: '', startTimeOf: () => 'x' }), false)
})
