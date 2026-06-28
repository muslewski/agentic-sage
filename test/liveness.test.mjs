import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAlive, deriveLiveness } from '../lib/liveness.mjs'

test('isAlive: own pid alive, a free pid not', () => {
  assert.equal(isAlive(process.pid), true)
  assert.equal(isAlive(2147483646), false)
  assert.equal(isAlive(0), false)
  assert.equal(isAlive(null), false)
})

test('deriveLiveness enum mapping', () => {
  const now = 1_000_000_000_000
  assert.equal(deriveLiveness({ closed: true }), 'closed')
  assert.equal(deriveLiveness({ alive: false }), 'dead')
  assert.equal(deriveLiveness({ alive: true, status: 'working', lastToolAt: now, now }), 'working')
  assert.equal(
    deriveLiveness({ alive: true, status: 'working', lastToolAt: now - 700000, now }),
    'stalled',
  )
  assert.equal(deriveLiveness({ alive: true }), 'idle')
  assert.equal(deriveLiveness({}), 'idle')
})
