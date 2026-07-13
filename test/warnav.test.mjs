import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  selectableIndices,
  moveSelection,
  selectedModelIndex,
  ensureVisible,
  matchFleet,
  isKillable,
  collectDead,
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

test('matchFleet: query matches window_name (tmux name shown in sessionRow)', () => {
  const fleet = {
    totals: { repos: 1, sessions: 2, live: 2, working: 0, contested: 0 },
    repos: [
      {
        label: 'alpha',
        sessions: [
          { branch: 'main', window_name: 'Hermes', liveness: 'idle' },
          { branch: 'feat/x', window_name: 'other', liveness: 'idle' },
        ],
      },
    ],
  }
  const hit = matchFleet(fleet, { query: 'Hermes' })
  assert.equal(hit.repos.length, 1)
  assert.equal(hit.repos[0].sessions.length, 1)
  assert.equal(hit.repos[0].sessions[0].window_name, 'Hermes')
})

test('isKillable: dead/closed yes; live/nullish no', () => {
  assert.equal(isKillable({ liveness: 'dead' }), true)
  assert.equal(isKillable({ liveness: 'closed' }), true)
  assert.equal(isKillable({ liveness: 'working' }), false)
  assert.equal(isKillable({ liveness: 'idle' }), false)
  assert.equal(isKillable(null), false)
  assert.equal(isKillable(undefined), false)
})

test('collectDead: flattens terminal sessions across repos, keeps repo_id + session_id', () => {
  const fleet = { repos: [
    { sessions: [
      { liveness: 'dead', repo_id: 'r1', session_id: 's1' },
      { liveness: 'working', repo_id: 'r1', session_id: 's2' },
    ] },
    { sessions: [{ liveness: 'closed', repo_id: 'r2', session_id: 's3' }] },
  ] }
  const dead = collectDead(fleet)
  assert.equal(dead.length, 2)
  assert.deepEqual(dead.map((s) => s.session_id).sort(), ['s1', 's3'])
  assert.equal(dead.find((s) => s.session_id === 's1').repo_id, 'r1')
})

test('collectDead: stamps repo_id from parent repoId when body omits it', () => {
  const fleet = {
    repos: [
      {
        repoId: 'parent-r1',
        sessions: [{ liveness: 'dead', session_id: 'orphan-sid' }],
      },
    ],
  }
  const dead = collectDead(fleet)
  assert.equal(dead.length, 1)
  assert.equal(dead[0].repo_id, 'parent-r1')
  assert.equal(dead[0].session_id, 'orphan-sid')
})

test('collectDead: empty/absent fleet is safe', () => {
  assert.deepEqual(collectDead({}), [])
  assert.deepEqual(collectDead({ repos: [{}] }), [])
})
