import { test } from 'node:test'
import assert from 'node:assert/strict'
import { floatHot } from '../lib/hotfloat.mjs'

const repo = (repoId, ...liveness) => ({
  repoId,
  sessions: liveness.map((l) => ({ liveness: l })),
})
const ids = (arr) => arr.map((r) => r.repoId)

test('floatHot: a repo with a working session floats above quiet repos', () => {
  const repos = [repo('a', 'idle'), repo('b', 'working'), repo('c', 'dead')]
  const { order, hotCount } = floatHot(repos, new Map(), 0)
  assert.deepEqual(ids(order), ['b', 'a', 'c'])
  assert.equal(hotCount, 1)
})

test('floatHot: quiet repos keep their stable input order (no reshuffle)', () => {
  const repos = [repo('a', 'idle'), repo('b', 'idle'), repo('c', 'idle')]
  const { order, hotCount } = floatHot(repos, new Map(), 0)
  assert.deepEqual(ids(order), ['a', 'b', 'c'])
  assert.equal(hotCount, 0)
})

test('floatHot: hysteresis keeps a briefly-cooled repo hot, then drops it after lingerMs', () => {
  const opts = { lingerMs: 4000 }
  // t=0: b is working → hot.
  let st = floatHot([repo('a', 'idle'), repo('b', 'working')], new Map(), 0, opts).hotState
  // t=1000: b went idle, but within linger → still floated on top.
  let r = floatHot([repo('a', 'idle'), repo('b', 'idle')], st, 1000, opts)
  assert.deepEqual(ids(r.order), ['b', 'a'], 'still hot within linger')
  st = r.hotState
  // t=5000: linger (4s) elapsed since last hot (t=0) → b drops back to stable order.
  r = floatHot([repo('a', 'idle'), repo('b', 'idle')], st, 5000, opts)
  assert.deepEqual(ids(r.order), ['a', 'b'], 'dropped after linger')
  assert.equal(r.hotCount, 0)
})

test('floatHot: staying warm re-arms the linger (no bounce on flicker)', () => {
  const opts = { lingerMs: 3000 }
  let st = floatHot([repo('b', 'working')], new Map(), 0, opts).hotState
  // idle at 2000 (within linger)
  st = floatHot([repo('b', 'idle')], st, 2000, opts).hotState
  // working again at 2500 → re-arms
  st = floatHot([repo('b', 'working')], st, 2500, opts).hotState
  // idle at 4000: only 1500ms since last hot (2500) < 3000 → still hot
  const r = floatHot([repo('b', 'idle')], st, 4000, opts)
  assert.equal(r.hotCount, 1)
})

test('floatHot: compacting counts as hot; gone repos are pruned from state', () => {
  const st = floatHot([repo('x', 'idle')], new Map(), 0).hotState
  const r = floatHot([{ repoId: 'y', sessions: [{ phase: 'compacting', liveness: 'idle' }] }], st, 10)
  assert.equal(r.hotCount, 1)
  assert.equal(r.hotState.has('x'), false) // x no longer present → not carried
})
