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
  // phase overrides for richer states; compacting is hot (working) for collision
  assert.equal(deriveLiveness({ alive: true, phase: 'compacting' }), 'working')
  assert.equal(deriveLiveness({ alive: true, lastToolAt: now - 700000, phase: 'compacting', now }), 'working')
  assert.equal(deriveLiveness({ closed: true, phase: 'compacting' }), 'closed')
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

// Golden compact sequence (plan 026 / interop contract): PreCompact stays hot,
// never closed/idle/stalled as the derived face; drain after phase clear.
test('interop golden compact sequence: phase compacting → working hot; clear → idle', () => {
  const now = 1_000_000_000_000
  // After PreCompact: record has phase; derive is working even if last_tool is stale.
  assert.equal(
    deriveLiveness({ alive: true, phase: 'compacting', lastToolAt: now - 700000, now }),
    'working',
  )
  // Closed always wins (session ended mid-compact is terminal for fleet).
  assert.equal(deriveLiveness({ closed: true, phase: 'compacting' }), 'closed')
  // After PostCompact: phase cleared; without fresh tool activity → idle.
  assert.equal(deriveLiveness({ alive: true, phase: undefined, now }), 'idle')
  // Fresh PostToolUse after compact → working again.
  assert.equal(deriveLiveness({ alive: true, lastToolAt: now, now }), 'working')
})
