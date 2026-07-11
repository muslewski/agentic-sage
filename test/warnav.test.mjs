import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  selectableIndices,
  moveSelection,
  selectedModelIndex,
  ensureVisible,
  matchFleet,
} from '../lib/warnav.mjs'

const model = [
  { text: '▌ alpha', isHeader: true },
  { text: '  ● a1', isHeader: false },
  { text: '  ● a2', isHeader: false },
  { text: '▌ beta', isHeader: true },
  { text: '  ● b1', isHeader: false },
]

test('selectableIndices: only non-header rows', () => {
  assert.deepEqual(selectableIndices(model), [1, 2, 4])
})

test('moveSelection: clamps both ends; empty → 0', () => {
  assert.equal(moveSelection(3, 0, -1), 0) // clamp low
  assert.equal(moveSelection(3, 2, 1), 2) // clamp high
  assert.equal(moveSelection(3, 0, 1), 1)
  assert.equal(moveSelection(0, 0, 1), 0) // nothing selectable
})

test('selectedModelIndex: ordinal → model index; null when none', () => {
  assert.equal(selectedModelIndex(model, 0), 1)
  assert.equal(selectedModelIndex(model, 2), 4)
  assert.equal(selectedModelIndex(model, 99), 4) // clamped
  assert.equal(selectedModelIndex([{ text: '▌ x', isHeader: true }], 0), null)
})

test('ensureVisible: reserves the top row for the sticky band', () => {
  const cases = [
    [1, 0, 6, 20, 0],
    [0, 0, 6, 20, 0],
    [8, 0, 6, 20, 3],
    [3, 5, 6, 20, 2],
    [19, 0, 6, 20, 14],
  ]
  for (const [idx, scroll, height, len, want] of cases) {
    assert.equal(ensureVisible(idx, scroll, height, len), want, `idx=${idx} scroll=${scroll}`)
  }
})

test('matchFleet: query narrows on repo+branch; totals preserved; empty repos drop', () => {
  const fleet = {
    totals: { repos: 2, sessions: 3, live: 3, working: 1, contested: 0 },
    repos: [
      { label: 'alpha', working: 1, sessions: [{ branch: 'main', liveness: 'working' }, { branch: 'feat/x', liveness: 'idle' }] },
      { label: 'beta', working: 0, sessions: [{ branch: 'main', liveness: 'idle' }] },
    ],
  }
  assert.equal(matchFleet(fleet, { query: 'feat' }).repos.length, 1) // only alpha has feat/x
  assert.equal(matchFleet(fleet, { query: 'feat' }).repos[0].sessions.length, 1)
  assert.equal(matchFleet(fleet, { query: 'beta' }).repos[0].label, 'beta')
  assert.deepEqual(matchFleet(fleet, { query: 'zzz' }).repos, []) // no match → empty
  assert.equal(matchFleet(fleet, { workingOnly: true }).repos[0].sessions.length, 1) // only working
  assert.deepEqual(matchFleet(fleet, {}).totals, fleet.totals) // no-op preserves everything
  assert.equal(matchFleet(fleet, { query: 'feat' }).totals, fleet.totals) // totals stay fleet-wide
})
