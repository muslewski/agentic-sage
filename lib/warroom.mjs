// The war-room cockpit renderers — pure, plain-text (color applied downstream
// at the bin/sage chokepoint, exactly like lib/board.mjs). Consumes the fleet
// shape from lib/fleet.mjs; emits a fixed-region frame: header + 3 stat panels
// + a scrollable session body + a footer. Working rows lead with ◆ so the shell
// can animate them by swapping ◆ → spinner frame (spinnerizeWar), scroll-proof.
import { zoneOf } from './board.mjs'
import { isNested } from './fleet.mjs'

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
export const sparkline = (values = []) => {
  const v = values.filter((x) => Number.isFinite(x))
  if (!v.length) return ''
  const max = Math.max(...v, 1)
  return v
    .map((x) => SPARK[Math.min(SPARK.length - 1, Math.round((x / max) * (SPARK.length - 1)))])
    .join('')
}

const padR = (s, n) => String(s ?? '').padEnd(n)
const stripAgo = (s) => String(s || '').replace(/\s*ago$/, '')

// Shorten to `n` display cols with a MIDDLE ellipsis, so both ends survive: a
// branch keeps its category prefix (docs/, feat/) AND its feature tail — and the
// ✎ dirty marker, which sits at the tail. No padding (see fit). Codepoint-safe.
export const clip = (s, n) => {
  const chars = [...String(s ?? '')]
  if (chars.length <= n) return chars.join('')
  if (n <= 1) return chars.slice(0, Math.max(0, n)).join('')
  const head = Math.ceil((n - 1) / 2)
  const tail = n - 1 - head
  return `${chars.slice(0, head).join('')}…${tail ? chars.slice(-tail).join('') : ''}`
}

// Keep the TAIL of a string in `n` display cols, dropping the head behind a
// leading … . For zone paths the deepest dir is the informative part; clip()'s
// middle ellipsis (right for branch ids) drops the leading char and reads as
// garbage. Codepoint-safe. No padding (see fitZone/fit).
export const clipLeft = (s, n) => {
  const chars = [...String(s ?? '')]
  if (chars.length <= n) return chars.join('')
  if (n <= 1) return chars.slice(-Math.max(0, n)).join('')
  return `…${chars.slice(-(n - 1)).join('')}`
}

// clip THEN pad to exactly `n` cols → a rigid grid: every column starts at the
// same screen x no matter how long the content is. This is the list-taming fix.
export const fit = (s, n) => padR(clip(s, n), n)
// Zone paths overflow with left-ellipsis (keep the deepest dir tail). When a
// trailing " +N" glob-overflow count is present, clip only the path and keep
// +N adjacent, then pad the whole to `n`. Bare long paths (no +N) also use
// clipLeft — middle-ellipsis would drop the leading chars of useful path tails.
export const fitZone = (s, n) => {
  const str = String(s ?? '')
  if ([...str].length <= n) return fit(str, n)
  const m = str.match(/ \+\d+$/)
  if (!m) return fit(clipLeft(str, n), n)
  const path = clipLeft(str.slice(0, -m[0].length), Math.max(1, n - [...m[0]].length))
  return fit(path + m[0], n)
}

// One rounded box, `w` TOTAL display columns wide. Every line is exactly `w`
// columns: top `╭─ TITLE ─…╮`, each body `│ …│`, bottom `╰─…╯`. Panel content is
// ASCII + block-sparkline (all width-1), so string length == display width here.
const box = (title, rows, w) => {
  const label = `─ ${title} ` // e.g. "─ FLEET "
  const top = `╭${label}${'─'.repeat(Math.max(0, w - 2 - label.length))}╮` // ╭+inner(w-2)+╮
  const body = rows.map((r) => `│ ${padR(r, w - 3)}│`) // │+space+content(w-3)+│ = w
  const bot = `╰${'─'.repeat(Math.max(0, w - 2))}╯`
  return [top, ...body, bot]
}

const W_FLEET = 15
const W_ACTIVE = 15
const W_HEAT = 26
export const PANEL_W = W_FLEET + W_ACTIVE + W_HEAT // total cockpit width (56)

// Three side-by-side panels as one 4-line block. The HEAT sparkline is capped to
// the last 12 samples so a growing ring buffer never overflows the panel.
export const renderPanels = (totals = {}, heatValues = []) => {
  // Live-first headlines: human/nested/hot/contested mean the living army, not
  // the on-disk graveyard. HEAT line 2: compacting face + honest ⚔ contested
  // (live-only from mergeBrief); calm "clear" when nothing is on fire.
  const t = {
    repos: 0,
    sessions: 0,
    live: 0,
    working: 0,
    contested: 0,
    compacting: 0,
    human: 0,
    nested: 0,
    ...totals,
  }
  const human = Number.isFinite(t.human)
    ? t.human
    : Math.max(0, (t.live || 0) - (t.nested || 0))
  const fleet = box('FLEET', [`${t.repos} repos`, `${human} human`], W_FLEET)
  const active = box('ACTIVE', [`${t.live} live`, `${t.nested || 0} nested`], W_ACTIVE)
  const spark = sparkline(heatValues.slice(-12))
  const heatBits = []
  if (t.compacting > 0) heatBits.push(`${t.compacting} compact`)
  if (t.contested > 0) heatBits.push(`${t.contested} ⚔`)
  const heatLine2 = heatBits.length ? heatBits.join(' · ') : 'clear'
  const heat = box(
    'HEAT',
    [`${spark ? `${spark}  ` : ''}${t.working} hot`, heatLine2],
    W_HEAT,
  )
  return fleet.map((ln, i) => ln + active[i] + heat[i]).join('\n')
}

// Terminal session (no longer collision-relevant).
const TERMINAL = new Set(['dead', 'closed'])
export const isTerminal = (s) => TERMINAL.has(s?.liveness)

// A ghost never spoke and never tool'd — /clear residue or abandoned spawn.
export const isGhostSession = (s) =>
  isTerminal(s) && !s?.last_prompt_at && !s?.last_tool_at

// Fold dead noise for the human eye. Live rows always pass through.
// Among terminal sessions with real activity, keep the newest per
// (worktree, branch); pure ghosts never get a row — only a count.
// Pure; order of live rows preserved; kept terminal appended by recency.
export const collapseChurn = (sessions = []) => {
  const live = []
  const terminal = []
  for (const s of sessions) {
    if (isTerminal(s)) terminal.push(s)
    else live.push(s)
  }
  let ghosts = 0
  const byKey = new Map()
  for (const s of terminal) {
    if (isGhostSession(s)) {
      ghosts++
      continue
    }
    const key = `${s.worktree || ''}\0${s.branch || ''}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, s)
      continue
    }
    const ta = Date.parse(s.updated_at || '') || 0
    const tb = Date.parse(prev.updated_at || '') || 0
    if (ta >= tb) byKey.set(key, s)
  }
  const kept = [...byKey.values()].sort((a, b) =>
    String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
  )
  const churn = Math.max(0, terminal.length - ghosts - kept.length)
  return { sessions: live.concat(kept), ghosts, churn }
}

// Fixed grid widths — every session row (and the column header) paints the same
// display-column count for the four cells. Trailing pad is KEPT (no rtrim) so
// empty HANDOFF / ZONE never shortens a row and jitters the right edge or wraps
// differently from a neighbour with content. Optional meta (↳row / ⚠) lives in a
// fixed 6-col slot after the grid; wide mode appends after that.
export const COL = { id: 26, status: 14, zone: 16, when: 10, meta: 6 }
// "  ● " (4) + id + 3×" │ " + status + zone + when + meta
export const ROW_W = 4 + COL.id + 3 * 3 + COL.status + COL.zone + COL.when + COL.meta // 85

// One session row, reusing board's vocabulary (tmux name · branch id, ✎ dirty,
// ctx %, zone, handoff freshness, ↳row, ⚠ orphan). Working leads ◆; all else ●.
export const sessionRow = (s, { wide } = {}) => {
  const isHot = s.liveness === 'working' || s.phase === 'compacting'
  const lead = isHot ? '◆' : '●'
  const label = s.window_name ? `${s.window_name} · ${s.branch || '(none)'}` : s.branch || '(none)'
  const id = `${label}${s.dirty ? ' ✎' : ''}`
  const ctx =
    s.ctx_used && s.ctx_window ? ` · ${Math.round((s.ctx_used / s.ctx_window) * 100)}%` : ''
  const dead = s.liveness === 'dead' || s.liveness === 'closed'
  const when =
    s.handoff_bucket === 'none' || !s.handoff_bucket
      ? ''
      : stripAgo(`${s.handoff_bucket} ${s.handoff_age}`)
  const zone = zoneOf(s.touched_globs)
  const meta = `${s.row ? `↳${s.row}` : ''}${dead && s.row ? '⚠' : ''}`
  const idw = wide
    ? `  ${String(s.session_id || '').slice(0, 8)}${s.tmux ? ` @${s.tmux}` : ''}`
    : ''
  const status = s.phase === 'compacting' ? 'compacting' : s.liveness
  // No trailing rtrim — fixed COL widths keep every row the same length.
  return (
    `  ${lead} ${fit(id, COL.id)} │ ${fit(status + ctx, COL.status)} │ ${fitZone(zone, COL.zone)} │ ${fit(when, COL.when)}${fit(meta, COL.meta)}` +
    idw
  )
}

// Sessions shown in the body for a repo (Layer B: hide nested by default).
// Nested filter only — churn collapse is applied by prepareRepoView.
export const visibleSessions = (repo, { showNested = false } = {}) => {
  const all = repo.sessions || []
  return showNested ? all : all.filter((s) => !isNested(s))
}

// Nested filter + ghost//clear collapse → the rows the human actually sees.
export const prepareRepoView = (repo, { showNested = false } = {}) => {
  const base = visibleSessions(repo, { showNested })
  const { sessions, ghosts, churn } = collapseChurn(base)
  return { sessions, ghosts, churn }
}

// Pin a repo band to exactly `width` display cols: left label + right rollup.
// Long rollups (ghosts/churn) shrink the left via middle-ellipsis rather than
// wrapping and shoving the whole cockpit frame around.
export const fitBand = (left, bits = [], width = PANEL_W) => {
  const w = Math.max(8, width)
  const roll = bits.length ? `· ${bits.join(' · ')}` : ''
  if (!roll) return padR(clip(String(left ?? ''), w), w)
  const rollChars = [...roll]
  // Prefer the full rollup on the right; clip the left label to fit.
  const maxLeft = Math.max(4, w - 1 - Math.min(rollChars.length, w - 5))
  const L = clip(String(left ?? ''), maxLeft)
  const rollFit = rollChars.length <= w - [...L].length - 1 ? roll : clip(roll, w - [...L].length - 1)
  const gap = Math.max(1, w - [...L].length - [...rollFit].length)
  const out = L + ' '.repeat(gap) + rollFit
  const chars = [...out]
  if (chars.length === w) return out
  if (chars.length < w) return out + ' '.repeat(w - chars.length)
  return chars.slice(0, w).join('')
}

// A repo is a parent BAND over its session rows: a left-margin accent bar ▌ +
// bright name (skinned in color.mjs), and a right-aligned "· N hot" / nested
// / ghosts / churn rollup. Layer B: human rows listed; nested folded until
// showNested; terminal ghosts never get their own rows.
export const renderRepoSection = (repo, { wide, showNested = false } = {}) => {
  const all = repo.sessions || []
  const nestedN = Number.isFinite(repo.nested) ? repo.nested : all.filter(isNested).length
  const { sessions, ghosts, churn } = prepareRepoView(repo, { showNested })
  const n = sessions.length
  const left = `▌ ${repo.label} · ${n} session${n === 1 ? '' : 's'}`
  const hot = repo.working || 0
  const bits = []
  if (hot > 0) bits.push(`${hot} hot`)
  if (nestedN > 0 && !showNested) bits.push(`+${nestedN} nested`)
  if (ghosts > 0) bits.push(`+${ghosts} ghosts`)
  if (churn > 0) bits.push(`+${churn} churn`)
  // Band width matches session grid so chrome + body share one vertical edge.
  const head = fitBand(left, bits, ROW_W)
  return [head, ...sessions.map((s) => sessionRow(s, { wide }))]
}

// Body as an attributed model: each entry carries its text, whether it IS a
// repo band header, and the header that GOVERNS it (a header governs itself).
// This attribution is what lets the viewport pin the right band while scrolling.
export const bodyModel = (fleet, { wide, showNested = false } = {}) =>
  (fleet.repos || []).flatMap((r) => {
    const { sessions } = prepareRepoView(r, { showNested })
    const [head, ...rows] = renderRepoSection(r, { wide, showNested })
    return [
      { text: head, header: head, isHeader: true, session: null },
      ...rows.map((t, i) => ({ text: t, header: head, isHeader: false, session: sessions[i] })),
    ]
  }) // Flat text lines (back-compat: the demo/tests + non-scrolling callers).
export const bodyLines = (fleet, opts) => bodyModel(fleet, opts).map((m) => m.text)

// Pure clamp + slice. height non-finite or ≥ length → the whole array.
export const viewport = (lines, { scroll = 0, height } = {}) => {
  if (!Number.isFinite(height) || height >= lines.length)
    return { slice: lines, scroll: 0, maxScroll: 0 }
  const maxScroll = Math.max(0, lines.length - height)
  const s = Math.max(0, Math.min(scroll, maxScroll))
  return { slice: lines.slice(s, s + height), scroll: s, maxScroll }
}

// Mark a session row as selected: swap its two leading spaces for "❯ " (painted
// bright downstream). Only touches a leading "  ", so repo bands are left alone.
export const markSelected = (text) => (text.startsWith('  ') ? `❯ ${text.slice(2)}` : text)

// Sticky-header viewport over the attributed model. Returns the windowed rows as
// ENTRIES ({ text, modelIndex }) so the caller can mark the cursor and know the
// pinned band is synthetic (modelIndex null). Pins the governing band on row 0
// when the top visible line is a row whose header scrolled off. `selected` is a
// model index (or null); its row gets the ❯ marker.
export const stickyViewport = (model, { scroll = 0, height, selected = null } = {}) => {
  const mark = (e) =>
    e.modelIndex !== null && e.modelIndex === selected ? { ...e, text: markSelected(e.text) } : e
  if (!Number.isFinite(height) || height >= model.length) {
    return {
      rows: model.map((m, i) => mark({ text: m.text, modelIndex: i })),
      scroll: 0,
      maxScroll: 0,
      stuck: null,
    }
  }
  const maxScroll = Math.max(0, model.length - height)
  const s = Math.max(0, Math.min(scroll, maxScroll))
  const win = model.slice(s, s + height)
  const top = win[0]
  if (top && !top.isHeader) {
    const rows = [
      { text: top.header, modelIndex: null, stuck: true },
      ...win.slice(1).map((m, i) => ({ text: m.text, modelIndex: s + 1 + i })),
    ]
    return { rows: rows.map(mark), scroll: s, maxScroll, stuck: top.header }
  }
  return {
    rows: win.map((m, i) => mark({ text: m.text, modelIndex: s + i })),
    scroll: s,
    maxScroll,
    stuck: null,
  }
}

export const footer = (
  showAll,
  scroll = 0,
  maxScroll = 0,
  {
    mode = 'nav',
    query = '',
    workingOnly = false,
    showNested = false,
    manageLabel = '',
    confirm = false,
    confirmCount = 0,
    deadCount = 0,
  } = {},
) => {
  // Confirm is mode-agnostic (nav X or manage X both land here).
  if (confirm) return ` clear ${confirmCount} dead session(s)? y/n`
  if (mode === 'filter') return ` filter: ${query}▌   esc clear · ↵ done`
  if (mode === 'manage') {
    return ` manage ‹${manageLabel}›   k kill · X clear all dead · esc back`
  }
  const pos = maxScroll > 0 ? ` · [${scroll}/${maxScroll}]` : ''
  const wf = workingOnly ? 'working✓' : 'working'
  const nf = showNested ? 'nested✓' : 'nested'
  // Keep an active text filter visible after ↵ returns to nav (body stays narrowed).
  const fq = query.trim() ? ` · filter✓ ${query.trim().slice(0, 24)}` : ''
  // When the graveyard is visible (or known), advertise the natural kill path.
  const deadHint =
    deadCount > 0
      ? showAll
        ? ` · X clear ${deadCount} dead`
        : ` · m manage`
      : ` · m manage`
  return ` ↵ enter · ↑↓ · / filter · w ${wf} · n ${nf} · c cd${deadHint} · a ${showAll ? 'dead✓' : 'all'} · q quit${fq}${pos}`
}

// Column-label header for the session grid — fixed chrome (NOT part of bodyModel,
// so it stays pinned while the body scrolls). Same COL widths as sessionRow;
// trailing pad kept so header and rows share one right edge.
export const columnHeader = () =>
  `    ${fit('SESSION', COL.id)} │ ${fit('STATUS', COL.status)} │ ${fit('ZONE', COL.zone)} │ ${fit('HANDOFF', COL.when)}${fit('', COL.meta)}`

// header(1) + panels(4) + columnHeader(1) + footer(1). The body fills the rest.
export const WAR_CHROME = 7

// The ⚔ glyph renders 2 cols in most terminals; count it as 2 so the clock
// right-aligns correctly against the cockpit width.
const headerLine = (clock, cols) => {
  const left = '⚔  SAGE WAR ROOM · fleet'
  const leftCols = left.length + 1 // ⚔ counts as 2 (one extra col over its length)
  if (!clock) return left
  const width = Math.max(leftCols + 2, Number.isFinite(cols) ? cols : PANEL_W)
  const gap = Math.max(2, width - leftCols - clock.length)
  return left + ' '.repeat(gap) + clock
}

export const renderWarRoom = (
  fleet,
  {
    showAll = false,
    heatValues = [],
    scroll = 0,
    rows = Infinity,
    cols = Infinity,
    wide = false,
    clock = '',
    selected = null,
    mode = 'nav',
    query = '',
    workingOnly = false,
    showNested = false,
    manageLabel = '',
    confirm = false,
    confirmCount = 0,
    deadCount = 0,
  } = {},
) => {
  const header = headerLine(clock, cols)
  const panels = renderPanels(fleet.totals, heatValues)
  const model = bodyModel(fleet, { wide, showNested })
  const height = Number.isFinite(rows) ? Math.max(1, rows - WAR_CHROME) : Infinity
  const vp = stickyViewport(model, { scroll, height, selected })
  const body = vp.rows.map((r) => r.text)
  // Prefer an explicit deadCount from the shell; else derive from totals.
  const dead =
    deadCount > 0
      ? deadCount
      : Math.max(0, (fleet.totals?.sessions || 0) - (fleet.totals?.live || 0))
  return [
    header,
    panels,
    columnHeader(),
    ...body,
    footer(showAll, vp.scroll, vp.maxScroll, {
      mode,
      query,
      workingOnly,
      showNested,
      manageLabel,
      confirm,
      confirmCount,
      deadCount: dead,
    }),
  ].join('\n')
}

// Swap every working glyph for the current spinner frame. ◆ appears only as a
// working-row lead, so a global replace is safe and survives scrolling.
export const spinnerizeWar = (text, frame) => text.replace(/◆/g, frame)
