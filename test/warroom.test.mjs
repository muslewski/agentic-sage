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
  collapseChurn,
  isGhostSession,
  prepareRepoView,
  fitBand,
  ROW_W,
  COL,
  layoutFor,
  handoffCell,
  renderHelp,
  HELP_KEYS,
  nameCell,
  branchCell,
  dividerEntry,
  liveModel,
} from '../lib/warroom.mjs'
import { selectableIndices, reselectBySid } from '../lib/warnav.mjs'

const fleet = {
  totals: { repos: 2, sessions: 3, live: 2, working: 1, contested: 1, compacting: 0, human: 2, nested: 1 },
  repos: [
    {
      label: 'alpha',
      nested: 1,
      working: 1,
      sessions: [
        { session_id: 'w1', branch: 'main', liveness: 'working', ctx_used: 43, ctx_window: 100, touched_globs: ['lib/x.mjs'], handoff_bucket: 'fresh', handoff_age: '4m ago', dirty: true },
        { session_id: 'i1', branch: 'feat', liveness: 'idle', touched_globs: ['hooks/'], handoff_bucket: 'none', handoff_age: '—', managed_by: 'nested' },
      ],
    },
    { label: 'beta', nested: 0, working: 1, sessions: [{ session_id: 'w2', branch: 'main', liveness: 'working', touched_globs: ['bin/'], handoff_bucket: 'fresh', handoff_age: '1m ago' }] },
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
  assert.match(p, /2 human/) // Layer B: human headline
  assert.match(p, /2 live/)
  assert.match(p, /1 nested/)
  assert.match(p, /1 working|1 hot/)
  assert.match(p, /1 ⚔|contested/) // honest live contested (⚔ glyph)
})

test('renderPanels: calm HEAT says clear; compacting surfaces on line 2', () => {
  const calm = renderPanels({ repos: 1, live: 1, working: 0, contested: 0, compacting: 0, human: 1, nested: 0 }, [])
  assert.match(calm, /clear/)
  assert.doesNotMatch(calm, /⚔/)
  const busy = renderPanels(
    { repos: 1, live: 2, working: 2, contested: 1, compacting: 2, human: 2, nested: 0 },
    [1, 2],
  )
  assert.match(busy, /2 compact/)
  assert.match(busy, /1 ⚔/)
})

test('collapseChurn: ghosts vanish into count; clear chain keeps newest per branch', () => {
  const rows = [
    { session_id: 'live', branch: 'feat', liveness: 'working', updated_at: '2026-07-14T12:00:00Z' },
    // pure ghosts — never prompted
    { session_id: 'g1', branch: 'main', liveness: 'closed', source: 'clear', updated_at: '2026-07-01T10:00:00Z' },
    { session_id: 'g2', branch: 'main', liveness: 'dead', updated_at: '2026-07-01T09:00:00Z' },
    // clear-churn with activity — keep newest only
    {
      session_id: 'c-old',
      branch: 'main',
      worktree: '/r',
      liveness: 'closed',
      source: 'clear',
      last_prompt_at: '2026-07-10T10:00:00Z',
      updated_at: '2026-07-10T10:00:00Z',
    },
    {
      session_id: 'c-new',
      branch: 'main',
      worktree: '/r',
      liveness: 'closed',
      source: 'clear',
      last_prompt_at: '2026-07-11T10:00:00Z',
      updated_at: '2026-07-11T10:00:00Z',
    },
  ]
  assert.equal(isGhostSession(rows[1]), true)
  const { sessions, ghosts, churn } = collapseChurn(rows)
  assert.equal(ghosts, 2)
  assert.equal(churn, 1) // c-old folded
  assert.equal(sessions.length, 2) // live + c-new
  assert.ok(sessions.some((s) => s.session_id === 'live'))
  assert.ok(sessions.some((s) => s.session_id === 'c-new'))
  assert.ok(!sessions.some((s) => s.session_id === 'c-old'))
})

test('prepareRepoView + band: ghosts roll into +N ghosts on the repo header', () => {
  const repo = {
    label: 'alpha',
    working: 0,
    nested: 0,
    sessions: [
      { session_id: 'live', branch: 'feat', liveness: 'idle', touched_globs: [] },
      { session_id: 'g1', branch: 'main', liveness: 'closed', touched_globs: [] },
      { session_id: 'g2', branch: 'main', liveness: 'dead', touched_globs: [] },
    ],
  }
  const v = prepareRepoView(repo, {})
  assert.equal(v.sessions.length, 1)
  assert.equal(v.ghosts, 2)
  const [head, ...rows] = renderRepoSection(repo, {})
  assert.match(head, /\+2 ghosts/)
  assert.equal(rows.length, 1)
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

test('fitZone: bare long path (no +N) also keeps tail via left-ellipsis', () => {
  const out = fitZone('syndcast/src/gallery/', 12)
  assert.equal([...out].length, 12)
  assert.equal(out[0], '…')
  assert.ok(out.endsWith('gallery/') || out.includes('gallery'), 'tail survives')
})

test('sessionRow: long branch clips; status columns stay aligned', () => {
  const opts = { cols: 80 }
  const long = sessionRow(
    {
      window_name: 'hermes',
      branch: 'docs/fusion-advisor-design-extra-long-name-that-definitely-overflows',
      liveness: 'idle',
      dirty: true,
    },
    opts,
  )
  const short = sessionRow({ window_name: 'x', branch: 'main', liveness: 'idle' }, opts)
  assert.equal(long.indexOf('idle'), short.indexOf('idle')) // grid aligned
  assert.equal([...long].length, ROW_W)
  assert.equal([...short].length, ROW_W)
  assert.match(long, /…/u) // long branch was clipped
  assert.match(long, /✎/) // dirty mark present
})

test('layoutFor: rowW never exceeds terminal cols (wrap is death)', () => {
  for (const c of [60, 72, 80, 100, 120]) {
    for (const showZone of [false, true]) {
      const L = layoutFor(c, { showZone })
      assert.ok(L.rowW <= c, `rowW ${L.rowW} > cols ${c}`)
      const row = sessionRow(
        { window_name: 'w', branch: 'main', liveness: 'idle', handoff_bucket: 'fresh', handoff_age: '1h ago' },
        { cols: c, showZone },
      )
      assert.equal([...row].length, L.rowW)
      assert.ok([...columnHeader(c, { showZone })].length <= c)
    }
  }
})

test('handoffCell: age-only compact (no fresh/ago — those wrapped onto the next line)', () => {
  assert.equal(handoffCell({ handoff_bucket: 'fresh', handoff_age: '1h ago' }), '1h')
  assert.equal(handoffCell({ handoff_bucket: 'fresh', handoff_age: 'just now' }), 'now')
  assert.equal(handoffCell({ handoff_bucket: 'none' }), '')
})

test('nameCell / branchCell: separate columns', () => {
  assert.equal(nameCell({ window_name: 'Hermes', branch: 'main' }), 'Hermes')
  assert.equal(branchCell({ window_name: 'Hermes', branch: 'main' }), 'main')
  assert.equal(nameCell({ branch: 'feat/x' }), '·') // placeholder when no tmux name
  assert.equal(branchCell({ branch: 'feat/x' }), 'feat/x')
})

test('sessionRow: working leads ◆, dirty marks ✎, idle leads ●', () => {
  assert.match(sessionRow(fleet.repos[0].sessions[0], {}), /^\s*◆ /u)
  assert.match(sessionRow(fleet.repos[0].sessions[0], {}), /✎/u)
  assert.match(sessionRow(fleet.repos[0].sessions[1], {}), /^\s*● /u)
})

test('sessionRow: NAME and BRANCH are separate cells (not glued)', () => {
  const r = sessionRow({ window_name: 'Hermes', branch: 'rtv-audio', liveness: 'idle' }, { cols: 80 })
  assert.match(r, /Hermes/)
  assert.match(r, /rtv-audio/)
  assert.doesNotMatch(r, /Hermes · rtv/)
  assert.equal((r.match(/ │ /g) || []).length, 4) // NAME|BRANCH|STATUS|ZONE|AGE
})

test('sessionRow: no tmux name → · in NAME, branch in BRANCH', () => {
  const r = sessionRow({ branch: 'main', liveness: 'idle' }, { cols: 80 })
  assert.match(r, /● · /)
  assert.match(r, /main/)
})

test('sessionRow: zone on by default; hide with showZone:false', () => {
  const s = { window_name: 'w', branch: 'main', liveness: 'idle', touched_globs: ['lib/warroom.mjs'] }
  const on = sessionRow(s, { cols: 80 }) // default
  const off = sessionRow(s, { cols: 80, showZone: false })
  assert.equal((on.match(/ │ /g) || []).length, 4) // NAME|BRANCH|STATUS|ZONE|AGE
  assert.equal((off.match(/ │ /g) || []).length, 3)
  assert.match(on, /lib\//)
})

test('renderRepoSection: calm band — no · N hot; short when no rollup', () => {
  const hot = renderRepoSection(
    { label: 'syndcast', working: 2, sessions: [{ branch: 'main', liveness: 'working', touched_globs: [] }] },
    { cols: 80 },
  )
  assert.match(hot[0], /^▌ syndcast · 1$/u) // no "hot" on the band
  assert.doesNotMatch(hot[0], /hot/)
  const nested = renderRepoSection(
    {
      label: 'alpha',
      working: 0,
      nested: 2,
      sessions: [
        { branch: 'x', liveness: 'idle', managed_by: 'human' },
        { branch: 'y', liveness: 'idle', managed_by: 'nested' },
        { branch: 'z', liveness: 'idle', managed_by: 'nested' },
      ],
    },
    { cols: 80 },
  )
  assert.match(nested[0], /\+2 nested/)
})

test('bodyLines: one header per repo + one row per session (nested folded by default)', () => {
  const lines = bodyLines(fleet, {})
  // alpha has 1 human + 1 nested → band shows · 1 + "+1 nested"
  assert.ok(lines.some((l) => /alpha · 1\b/.test(l)))
  assert.ok(lines.some((l) => /\+1 nested/.test(l)))
  assert.ok(lines.some((l) => /beta · 1\b/.test(l)))
  assert.equal(lines.filter((l) => /◆|●/u.test(l)).length, 2) // human rows only
})

test('bodyLines showNested: expands nested armory children into body', () => {
  const lines = bodyLines(fleet, { showNested: true })
  assert.ok(lines.some((l) => /alpha · 2\b/.test(l)))
  assert.equal(lines.filter((l) => /◆|●/u.test(l)).length, 3)
  assert.doesNotMatch(lines.join('\n'), /\+1 nested/)
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
  const frame = renderWarRoom(fleet, {
    showAll: false,
    heatValues: [1, 2],
    scroll: 0,
    rows: Infinity,
    cols: 80,
    clock: '12:00:00',
  })
  assert.match(frame, /SAGE WAR ROOM/)
  assert.match(frame, /\bq\b/) // compact footer ends with q
  const lines = frame.split('\n')
  const bodyCount = bodyLines({ ...fleet, cols: 80 }, { cols: 80 }).length
  assert.equal(lines.length, bodyCount + WAR_CHROME)
  // No body/header line wider than the terminal (the wrap bug).
  for (const ln of lines.slice(0, -1)) {
    // panels are 56; body is layout rowW; header may use full cols
    assert.ok([...ln].length <= 120, `line too wide: ${[...ln].length} ${ln.slice(0, 40)}`)
  }
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

test('footer: labeled keys with words; filter mode shows the query', () => {
  const nav = footer(false, 0, 0, { cols: 80 })
  assert.match(nav, /move/)
  assert.match(nav, /open/)
  assert.match(nav, /filter/)
  assert.match(nav, /help/)
  assert.match(nav, /quit/)
  assert.match(nav, /faces/)
  assert.ok([...nav].length <= 80, `nav footer wrap-safe: ${[...nav].length}`)
  const on = footer(false, 0, 0, { cols: 80, workingOnly: true, showNested: true })
  assert.match(on, /work✓/)
  // nest✓ may pack out when tail is long — work✓ is enough for active chip
  const filt = footer(false, 0, 0, { mode: 'filter', query: 'arm' })
  assert.match(filt, /arm/)
  assert.match(filt, /esc/)
  const chip = footer(false, 0, 0, { mode: 'nav', query: 'Hermes', cols: 80 })
  assert.match(chip, /f:Hermes/)
  const mem = footer(true, 0, 0, { cols: 80, deadCount: 600, face: 'memory' })
  assert.match(mem, /clear/)
  assert.ok([...mem].length <= 80)
})

test('renderHelp + help mode: full key map; every line ≤ row width', () => {
  assert.ok(HELP_KEYS.length >= 8)
  const lines = renderHelp(80)
  assert.ok(lines.some((l) => /SAGE WAR ROOM — help/.test(l)))
  assert.ok(lines.some((l) => /X\s+then y/.test(l) || /clear ALL dead/.test(l)))
  assert.ok(lines.some((l) => /\?/.test(l)))
  for (const ln of lines) assert.equal([...ln].length, ROW_W)
  // 24-row terminal must show the full map (panels dropped in help mode).
  const frame = renderWarRoom(fleet, { mode: 'help', cols: 80, rows: 24, clock: '12:00:00' })
  assert.match(frame, /SAGE WAR ROOM — help/)
  assert.match(frame, /clear ALL dead/)
  assert.match(frame, /force refresh/)
  assert.match(frame, /esc close|\? help/)
  assert.equal(frame.split('\n').length, 24)
})

test('footer: manage mode shows the action menu', () => {
  const menu = footer(false, 0, 0, { mode: 'manage', manageLabel: 'Hermes · main' })
  assert.match(menu, /manage/)
  assert.match(menu, /Hermes · main/)
  assert.match(menu, /k kill/)
  assert.match(menu, /X clear-all|X all dead/)
  assert.match(menu, /esc/)
})

test('footer: manage confirm shows a y/n prompt with the count', () => {
  const conf = footer(false, 0, 0, { mode: 'manage', confirm: true, confirmCount: 31 })
  assert.match(conf, /clear 31 dead/)
  assert.match(conf, /y confirm/)
  // Confirm is mode-agnostic (nav X uses the same footer).
  const fromNav = footer(true, 0, 0, { mode: 'nav', confirm: true, confirmCount: 590 })
  assert.match(fromNav, /clear 590 dead/)
})

test('footer: MEMORY face advertises clear/manage', () => {
  const mem = footer(true, 0, 0, { deadCount: 590, cols: 80, face: 'memory' })
  assert.match(mem, /clear/)
  assert.match(mem, /manage/)
  assert.ok([...mem].length <= 80, 'memory footer must stay wrap-safe')
  const clash = footer(false, 0, 0, { cols: 80, face: 'clash' })
  assert.match(clash, /faces/)
})

test('sessionRow: columns separated by " │ " rules (zone on = 4 rules)', () => {
  const row = sessionRow({
    session_id: 'w1',
    window_name: 'w',
    branch: 'main',
    liveness: 'working',
    ctx_used: 43,
    ctx_window: 100,
    touched_globs: ['lib/x.mjs'],
    handoff_bucket: 'fresh',
    handoff_age: '4m ago',
    dirty: true,
  })
  assert.equal((row.match(/ │ /g) || []).length, 4) // NAME|BRANCH|STATUS|ZONE|AGE
  assert.match(row, /working/)
})

test('sessionRow: fixed grid width — empty handoff does not shorten the row', () => {
  const empty = sessionRow({ session_id: 'x', branch: 'main', liveness: 'closed', handoff_bucket: 'none' })
  const full = sessionRow({
    session_id: 'y',
    window_name: 'y',
    branch: 'main',
    liveness: 'idle',
    handoff_bucket: 'fresh',
    handoff_age: '4m ago',
    touched_globs: ['lib/x.mjs'],
    row: 'D7',
  })
  assert.equal([...empty].length, ROW_W)
  assert.equal([...full].length, ROW_W)
  assert.equal(empty.indexOf('closed'), full.indexOf('idle')) // status col aligned
  assert.ok(empty.includes(' │ '))
})

test('fitBand: always exactly width; long rollup clips left, not wrap', () => {
  const short = fitBand('▌ alpha · 1 session', [], 40)
  assert.equal([...short].length, 40)
  const rolled = fitBand('▌ syndcast · 12 sessions', ['3 hot', '+40 ghosts', '+9 churn'], 56)
  assert.equal([...rolled].length, 56)
  assert.match(rolled, /ghosts/)
})

test('columnHeader: NAME | BRANCH | STATUS | ZONE | AGE by default', () => {
  const h = columnHeader(80)
  assert.match(h, /NAME/)
  assert.match(h, /BRANCH/)
  assert.match(h, /STATUS/)
  assert.match(h, /ZONE/)
  assert.match(h, /AGE/)
  assert.equal((h.match(/ │ /g) || []).length, 4)
  assert.equal(h.indexOf('NAME'), 4)
  assert.equal([...h].length, ROW_W)
  const off = columnHeader(80, { showZone: false })
  assert.doesNotMatch(off, /ZONE/)
  assert.equal((off.match(/ │ /g) || []).length, 3)
})

test('WAR_CHROME is 7 and renderWarRoom stays self-consistent', () => {
  assert.equal(WAR_CHROME, 7)
  const lines = renderWarRoom(fleet, { rows: Infinity, cols: 80 }).split('\n')
  const bodyCount = bodyModel(fleet, { cols: 80 }).length
  assert.equal(lines.length, bodyCount + WAR_CHROME) // header+panels(4)+colHeader+footer = 7
})

test('renderWarRoom includes the column header line above the body', () => {
  const lines = renderWarRoom(fleet, { rows: Infinity, cols: 80 }).split('\n')
  // line 0 = ⚔ header, 1..4 = panels, line 5 = column header
  assert.match(lines[5], /NAME.*BRANCH.*STATUS.*ZONE.*AGE/)
  const noZone = renderWarRoom(fleet, { rows: Infinity, cols: 80, showZone: false }).split('\n')
  assert.doesNotMatch(noZone[5], /ZONE/)
})

// ── LIVE hot-float divider (fleet.sortFleet → hotfloat.floatHot → liveModel) ──
const mkRepo = (id, ...liveness) => ({
  repoId: id,
  label: id,
  sessions: liveness.map((l, i) => ({ session_id: `${id}${i}`, branch: 'main', liveness: l, window_name: id })),
})

test('dividerEntry: a non-selectable rule pinned to rowW', () => {
  const d = dividerEntry(100, { showZone: true })
  assert.equal(d.isHeader, true) // never a cursor target
  assert.equal(d.divider, true)
  assert.equal(d.session, null)
  assert.equal([...d.text].length, layoutFor(100, { showZone: true }).rowW)
  assert.match(d.text, /quiet/)
})

test('liveModel: divider sits between the hot group and the quiet remainder; cursor skips it', () => {
  // view.repos already [hot…, quiet…]; hotCount = 2 → split after the 2nd band.
  const view = { repos: [mkRepo('hotA', 'working'), mkRepo('hotB', 'working', 'idle'), mkRepo('quietC', 'idle'), mkRepo('quietD', 'idle')], totals: {} }
  const model = liveModel(view, { hotCount: 2, cols: 100, showZone: true })
  const divIdx = model.findIndex((m) => m.divider)
  assert.ok(divIdx > 0, 'divider present')
  // Everything before the divider belongs to a hot repo; nothing after does.
  const sel = selectableIndices(model)
  assert.equal(sel.includes(divIdx), false) // divider is not selectable
  assert.ok(sel.every((i) => !model[i].isHeader)) // only session rows selectable
  // Selection follows a quiet-group session across the divider on rebuild.
  const ord = reselectBySid(model, 'quietC0', 0)
  assert.equal(model[sel[ord]].session.session_id, 'quietC0')
})

test('liveModel: no divider when every live repo is hot (or none are)', () => {
  const allHot = { repos: [mkRepo('a', 'working'), mkRepo('b', 'working')], totals: {} }
  assert.equal(liveModel(allHot, { hotCount: 2, cols: 100 }).some((m) => m.divider), false)
  const noneHot = { repos: [mkRepo('a', 'idle')], totals: {} }
  assert.equal(liveModel(noneHot, { hotCount: 0, cols: 100 }).some((m) => m.divider), false)
})
