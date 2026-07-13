import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sparkline,
  renderPanels,
  sessionRow,
  renderRepoSection,
  bodyLines,
  bodyModel,
  viewport,
  stickyViewport,
  markSelected,
  footer,
  renderWarRoom,
  spinnerizeWar,
  fit,
  fitZone,
  clipLeft,
  columnHeader,
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

test('fit: pads short to exact width, middle-ellipsis keeps head+tail on long', () => {
  assert.equal(fit('main', 8), 'main    ') // short → padded to n
  assert.equal([...fit('docs/fusion-advisor-design', 20)].length, 20) // long → exactly n
  assert.match(fit('docs/fusion-advisor-design', 20), /^docs\/.*….*design$/u) // both ends survive
})

test('fitZone: clips the path but keeps the +N overflow count adjacent', () => {
  const z = fitZone('docs/superpowers/plans/ +1', 16)
  assert.equal([...z].length, 16) // rigid width
  assert.match(z, /….*\+1$/u) // path clipped, +1 preserved at the tail
})

test('clipLeft: keeps the tail, leading … when truncated; codepoint-safe', () => {
  assert.equal(clipLeft('gallery/', 12), 'gallery/') // fits → unchanged
  assert.equal([...clipLeft('syndcast/src/gallery/', 12)].length, 12) // exactly n cols
  assert.equal(clipLeft('syndcast/src/gallery/', 12)[0], '…') // leads with ellipsis
  assert.ok(clipLeft('syndcast/src/gallery/', 12).endsWith('gallery/')) // tail survives
  assert.equal(clipLeft('', 5), '') // empty → empty
})

test('fitZone: keeps path tail (not middle) and preserves the +N suffix', () => {
  const out = fitZone('syndcast/src/gallery/ +1', 16)
  assert.equal([...out].length, 16) // padded/clipped to exactly n
  assert.ok(out.includes('+1'), 'the +N overflow count survives') // suffix kept
  assert.ok(out.includes('gallery/'), 'the deepest dir (tail) survives') // tail kept, not dropped
})

test('sessionRow: long names clip to a fixed grid so status columns align', () => {
  // regression: padR padded but never truncated → long branch ids shoved every
  // later column rightward. Now every row's liveness word lands at the same col.
  const long = sessionRow({ branch: 'docs/fusion-advisor-design', liveness: 'idle', dirty: true, touched_globs: [] }, {})
  const short = sessionRow({ branch: 'main', liveness: 'idle', touched_globs: [] }, {})
  assert.equal(long.indexOf('idle'), short.indexOf('idle')) // grid aligned
  assert.match(long, /…/u) // long name was clipped
  assert.match(long, /✎.*idle/u) // middle-ellipsis kept the tail ✎ marker (now with │ sep)
})

test('sessionRow: working leads ◆, dirty marks ✎, idle leads ●', () => {
  assert.match(sessionRow(fleet.repos[0].sessions[0], {}), /^\s*◆ /u)
  assert.match(sessionRow(fleet.repos[0].sessions[0], {}), /✎/u)
  assert.match(sessionRow(fleet.repos[0].sessions[1], {}), /^\s*● /u)
})

test('sessionRow: tmux name shown as "window_name · branch"', () => {
  const r = sessionRow({ window_name: 'Hermes', branch: 'rtv-audio', liveness: 'idle', touched_globs: [] }, {})
  assert.match(r, /Hermes · rtv-audio/u)
})

test('sessionRow: no tmux name → plain branch, no dangling separator', () => {
  const r = sessionRow({ branch: 'main', liveness: 'idle', touched_globs: [] }, {})
  assert.match(r, /● main /u)
  assert.doesNotMatch(r, / · main/u) // no leading "name ·" when window_name absent
})

test('sessionRow: long combined name clips (middle ellipsis) and keeps grid + ✎', () => {
  const long = sessionRow({ window_name: 'syndcast-75', branch: 'feat/vellum-notes-ia', liveness: 'idle', dirty: true, touched_globs: [] }, {})
  const short = sessionRow({ window_name: 'x', branch: 'main', liveness: 'idle', touched_globs: [] }, {})
  assert.match(long, /…/u) // clipped
  assert.match(long, /✎.*idle/u) // ✎ tail survived the clip, padded to liveness (now with │ sep)
  assert.equal(long.indexOf('idle'), short.indexOf('idle')) // rigid grid still aligned
})

test('renderRepoSection: accent-bar band; hot rollup only when working > 0', () => {
  const hot = renderRepoSection(
    { label: 'syndcast', working: 2, sessions: [{ branch: 'main', liveness: 'working', touched_globs: [] }] },
    {},
  )
  assert.match(hot[0], /^▌ syndcast · 1 session/u) // margin bar + name
  assert.match(hot[0], /· 2 hot$/u) // rollup on the right
  const cold = renderRepoSection(
    { label: 'alpha', working: 0, sessions: [{ branch: 'x', liveness: 'idle', touched_globs: [] }] },
    {},
  )
  assert.equal(cold[0], '▌ alpha · 1 session') // calm repo stays quiet — no rollup
})

test('bodyLines: one header per repo + one row per session', () => {
  const lines = bodyLines(fleet, {})
  assert.ok(lines.some((l) => /alpha · 2 session/.test(l)))
  assert.ok(lines.some((l) => /beta · 1 session/.test(l)))
  assert.equal(lines.filter((l) => /◆|●/u.test(l)).length, 3) // 3 session rows
})

const scrollFleet = {
  repos: [
    {
      label: 'alpha',
      working: 0,
      sessions: [
        { branch: 'a1', liveness: 'idle', touched_globs: [] },
        { branch: 'a2', liveness: 'idle', touched_globs: [] },
        { branch: 'a3', liveness: 'idle', touched_globs: [] },
      ],
    },
    { label: 'beta', working: 0, sessions: [{ branch: 'b1', liveness: 'idle', touched_globs: [] }] },
  ],
}

test('bodyModel: headers tagged; every row attributed to its band', () => {
  const model = bodyModel(scrollFleet, {})
  assert.equal(model[0].isHeader, true) // alpha band
  assert.match(model[0].header, /^▌ alpha/u)
  assert.equal(model[1].isHeader, false) // a1 row
  assert.equal(model[1].header, model[0].text) // governed by the alpha band
  assert.equal(model[4].isHeader, true) // beta band
})

test('bodyModel: row entries carry their session handle; headers carry null', () => {
  const fleet = { repos: [{ label: 'alpha', working: 0, sessions: [{ branch: 'a1', liveness: 'idle', touched_globs: [], pid: 123 }] }] }
  const model = bodyModel(fleet, {})
  assert.equal(model[0].session, null) // band
  assert.equal(model[1].session, fleet.repos[0].sessions[0]) // row → its session (pid 123)
})

test('stickyViewport: pins the governing band once its header scrolls off', () => {
  // model: [Ahdr, a1, a2, a3, Bhdr, b1]
  const model = bodyModel(scrollFleet, {})
  const v0 = stickyViewport(model, { scroll: 0, height: 3 })
  assert.match(v0.rows[0].text, /^▌ alpha/u)
  assert.equal(v0.stuck, null)
  const v2 = stickyViewport(model, { scroll: 2, height: 3 })
  assert.match(v2.rows[0].text, /^▌ alpha/u) // stuck band
  assert.equal(v2.rows[0].modelIndex, null) // synthetic pin
  assert.match(v2.rows[1].text, /a3/)
  assert.match(v2.rows[2].text, /▌ beta/u)
  assert.equal(v2.rows.length, 3)
  assert.match(v2.stuck, /^▌ alpha/u)
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

test('markSelected: swaps the two leading spaces for the ❯ cursor', () => {
  assert.equal(markSelected('  ● main  idle'), '❯ ● main  idle')
  assert.equal(markSelected('▌ alpha'), '▌ alpha') // headers untouched (no leading "  ")
})

test('stickyViewport marks exactly the selected model row', () => {
  const model = bodyModel(scrollFleet, {}) // [Ahdr, a1, a2, a3, Bhdr, b1]
  const vp = stickyViewport(model, { scroll: 0, height: 6, selected: 2 }) // a2
  const cursored = vp.rows.filter((r) => r.text.startsWith('❯'))
  assert.equal(cursored.length, 1)
  assert.equal(cursored[0].modelIndex, 2)
  const none = stickyViewport(model, { scroll: 0, height: 6, selected: null })
  assert.equal(none.rows.filter((r) => r.text.startsWith('❯')).length, 0)
})

test('renderWarRoom with selected shows one ❯; selected:null shows none', () => {
  const withSel = renderWarRoom(fleet, { rows: Infinity, clock: '12:00:00', selected: 1 })
  assert.equal(withSel.split('\n').filter((l) => l.startsWith('❯')).length, 1)
  const noSel = renderWarRoom(fleet, { rows: Infinity, clock: '12:00:00' })
  assert.equal(noSel.split('\n').filter((l) => l.startsWith('❯')).length, 0)
})

test('footer: nav shows filter + working keys; filter mode shows the query', () => {
  const nav = footer(false, 0, 0, {})
  assert.match(nav, /\/ filter/)
  assert.match(nav, /w working/)
  const on = footer(false, 0, 0, { workingOnly: true })
  assert.match(on, /working✓/)
  const filt = footer(false, 0, 0, { mode: 'filter', query: 'arm' })
  assert.match(filt, /filter: arm/)
  assert.match(filt, /esc/)
})

test('footer: manage mode shows the action menu', () => {
  const menu = footer(false, 0, 0, { mode: 'manage', manageLabel: 'Hermes · main' })
  assert.match(menu, /manage ‹Hermes · main›/u)
  assert.match(menu, /k kill/)
  assert.match(menu, /X clear all dead/)
  assert.match(menu, /esc back/)
})

test('footer: manage confirm shows a y/n prompt with the count', () => {
  const conf = footer(false, 0, 0, { mode: 'manage', confirm: true, confirmCount: 31 })
  assert.match(conf, /clear 31 dead session\(s\)\? y\/n/)
})

test('footer: nav advertises the manage key', () => {
  assert.match(footer(false, 0, 0, {}), /m manage/)
})

test('sessionRow: columns separated by " │ " rules', () => {
  const row = sessionRow({ session_id: 'w1', branch: 'main', liveness: 'working', ctx_used: 43, ctx_window: 100, touched_globs: ['lib/x.mjs'], handoff_bucket: 'fresh', handoff_age: '4m ago', dirty: true })
  assert.equal((row.match(/ │ /g) || []).length, 3) // exactly 3 rules between 4 columns
  assert.match(row, /working/) // status token stays a clean, standalone token
})

test('sessionRow: empty trailing cells still trimmed, no dangling rule pad', () => {
  const row = sessionRow({ session_id: 'x', branch: 'main', liveness: 'closed', handoff_bucket: 'none' })
  assert.equal(row, row.replace(/\s+$/, '')) // no trailing whitespace
  assert.ok(row.includes(' │ ')) // rules present even with empty zone/when
})

test('columnHeader: labels present, grid-aligned, rules match sessionRow', () => {
  const h = columnHeader()
  assert.match(h, /SESSION/)
  assert.match(h, /STATUS/)
  assert.match(h, /ZONE/)
  assert.match(h, /HANDOFF/)
  assert.equal((h.match(/ │ /g) || []).length, 3) // same 3 rules as a data row
  // SESSION starts at column 4 (clears the "  ● " glyph gutter of a data row)
  assert.equal(h.indexOf('SESSION'), 4)
})

test('WAR_CHROME is 7 and renderWarRoom stays self-consistent', () => {
  assert.equal(WAR_CHROME, 7)
  const lines = renderWarRoom(fleet, { rows: Infinity }).split('\n')
  const bodyCount = bodyModel(fleet).length
  assert.equal(lines.length, bodyCount + WAR_CHROME) // header+panels(4)+colHeader+footer = 7
})

test('renderWarRoom includes the column header line above the body', () => {
  const lines = renderWarRoom(fleet, { rows: Infinity }).split('\n')
  // line 0 = ⚔ header, 1..4 = panels, line 5 = column header
  assert.match(lines[5], /SESSION.*STATUS.*ZONE.*HANDOFF/)
})
