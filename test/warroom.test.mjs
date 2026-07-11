import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sparkline,
  renderPanels,
  sessionRow,
  bodyLines,
  viewport,
  footer,
  renderWarRoom,
  spinnerizeWar,
  WAR_CHROME,
} from '../lib/warroom.mjs'

const fleet = {
  totals: { repos: 2, sessions: 3, live: 2, working: 1, contested: 1 },
  repos: [
    {
      label: 'alpha',
      sessions: [
        { session_id: 'w1', branch: 'main', liveness: 'working', ctx_used: 43, ctx_window: 100, touched_globs: ['lib/x.mjs'], handoff_bucket: 'fresh', handoff_age: '4m ago', dirty: true },
        { session_id: 'i1', branch: 'feat', liveness: 'idle', touched_globs: ['hooks/'], handoff_bucket: 'none', handoff_age: '—' },
      ],
    },
    { label: 'beta', sessions: [{ session_id: 'w2', branch: 'main', liveness: 'working', touched_globs: ['bin/'], handoff_bucket: 'fresh', handoff_age: '1m ago' }] },
  ],
}

test('sparkline: empty → "", scales to max', () => {
  assert.equal(sparkline([]), '')
  assert.equal(sparkline([0, 4]).length, 2)
  assert.match(sparkline([0, 1, 2, 3]), /^[▁▂▃▄▅▆▇█]{4}$/u)
})

test('renderPanels shows totals + is exactly 4 lines', () => {
  const p = renderPanels(fleet.totals, [1, 2, 3])
  assert.equal(p.split('\n').length, 4)
  assert.match(p, /2 repos/)
  assert.match(p, /2 live/)
  assert.match(p, /1 working|1 hot/)
})

test('renderPanels: every line is the same display width (borders align)', () => {
  // regression: the box() body row was 1 col short of top/bottom → right borders
  // walked left. All four lines must be identical width, with a growing spark.
  for (const heat of [[], [1, 2, 3], Array.from({ length: 30 }, (_, i) => i)]) {
    const widths = renderPanels(fleet.totals, heat).split('\n').map((l) => [...l].length)
    assert.equal(new Set(widths).size, 1, `unequal panel widths: ${widths}`)
  }
})

test('sessionRow: working leads ◆, dirty marks ✎, idle leads ●', () => {
  assert.match(sessionRow(fleet.repos[0].sessions[0], {}), /^\s*◆ /u)
  assert.match(sessionRow(fleet.repos[0].sessions[0], {}), /✎/u)
  assert.match(sessionRow(fleet.repos[0].sessions[1], {}), /^\s*● /u)
})

test('bodyLines: one header per repo + one row per session', () => {
  const lines = bodyLines(fleet, {})
  assert.ok(lines.some((l) => /alpha · 2 session/.test(l)))
  assert.ok(lines.some((l) => /beta · 1 session/.test(l)))
  assert.equal(lines.filter((l) => /◆|●/u.test(l)).length, 3) // 3 session rows
})

test('viewport clamps + slices to height', () => {
  const lines = ['a', 'b', 'c', 'd', 'e']
  assert.deepEqual(viewport(lines, { scroll: 0, height: 2 }).slice, ['a', 'b'])
  const v = viewport(lines, { scroll: 99, height: 2 })
  assert.deepEqual(v.slice, ['d', 'e']) // clamped to bottom
  assert.equal(v.scroll, 3)
  assert.equal(v.maxScroll, 3)
  assert.deepEqual(viewport(lines, { scroll: 0, height: Infinity }).slice, lines)
})

test('renderWarRoom composes; non-body lines == WAR_CHROME; footer present', () => {
  const frame = renderWarRoom(fleet, { showAll: false, heatValues: [1, 2], scroll: 0, rows: Infinity, clock: '12:00:00' })
  assert.match(frame, /SAGE WAR ROOM/)
  assert.match(frame, /q quit/)
  const lines = frame.split('\n')
  const bodyCount = bodyLines({ ...fleet }, {}).length
  assert.equal(lines.length, bodyCount + WAR_CHROME)
})

test('spinnerizeWar swaps ◆ for the frame glyph', () => {
  assert.equal(spinnerizeWar('  ◆ main working', '⠹'), '  ⠹ main working')
  assert.ok(!spinnerizeWar('  ◆ a\n  ◆ b', '⠹').includes('◆'))
})
