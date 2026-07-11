// The war-room cockpit renderers — pure, plain-text (color applied downstream
// at the bin/sage chokepoint, exactly like lib/board.mjs). Consumes the fleet
// shape from lib/fleet.mjs; emits a fixed-region frame: header + 3 stat panels
// + a scrollable session body + a footer. Working rows lead with ◆ so the shell
// can animate them by swapping ◆ → spinner frame (spinnerizeWar), scroll-proof.
import { zoneOf } from './board.mjs'

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
// clip THEN pad to exactly `n` cols → a rigid grid: every column starts at the
// same screen x no matter how long the content is. This is the list-taming fix.
export const fit = (s, n) => padR(clip(s, n), n)
// Zone paths overflow too, but the trailing " +N" glob-overflow count is the most
// informative part — clip only the path, keep +N adjacent, pad the whole to `n`.
export const fitZone = (s, n) => {
  const str = String(s ?? '')
  const m = str.match(/ \+\d+$/)
  if (!m || [...str].length <= n) return fit(str, n)
  const path = clip(str.slice(0, -m[0].length), Math.max(1, n - [...m[0]].length))
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
  const t = { repos: 0, sessions: 0, live: 0, working: 0, contested: 0, ...totals }
  const fleet = box('FLEET', [`${t.repos} repos`, `${t.sessions} sessions`], W_FLEET)
  const active = box('ACTIVE', [`${t.live} live`, `${t.working} working`], W_ACTIVE)
  const spark = sparkline(heatValues.slice(-12))
  const heat = box(
    'HEAT',
    [`${spark ? `${spark}  ` : ''}${t.working} hot`, `contested ${t.contested}`],
    W_HEAT,
  )
  return fleet.map((ln, i) => ln + active[i] + heat[i]).join('\n')
}

// One session row, reusing board's vocabulary (branch id, ✎ dirty, ctx %, zone,
// handoff freshness, ↳row, ⚠ orphan). Working leads ◆; all else ●.
export const sessionRow = (s, { wide } = {}) => {
  const lead = s.liveness === 'working' ? '◆' : '●'
  const id = `${s.branch || '(none)'}${s.dirty ? ' ✎' : ''}`
  const ctx =
    s.ctx_used && s.ctx_window ? ` · ${Math.round((s.ctx_used / s.ctx_window) * 100)}%` : ''
  const dead = s.liveness === 'dead' || s.liveness === 'closed'
  const when =
    s.handoff_bucket === 'none' || !s.handoff_bucket
      ? ''
      : stripAgo(`${s.handoff_bucket} ${s.handoff_age}`)
  const zone = zoneOf(s.touched_globs)
  const tail = `${s.row ? `↳${s.row}` : ''}${dead && s.row ? ' ⚠' : ''}`
  const idw = wide
    ? `  ${String(s.session_id || '').slice(0, 8)}${s.tmux ? ` @${s.tmux}` : ''}`
    : ''
  return `  ${lead} ${fit(id, 20)} ${fit(s.liveness + ctx, 14)} ${fitZone(zone, 16)} ${fit(when, 10)}${tail ? ` ${tail}` : ''}${idw}`.replace(
    /\s+$/,
    '',
  )
}

export const renderRepoSection = (repo, { wide } = {}) => {
  const n = repo.sessions.length
  const head = ` ${repo.label} · ${n} session${n === 1 ? '' : 's'}`
  return [head, ...repo.sessions.map((s) => sessionRow(s, { wide }))]
}

export const bodyLines = (fleet, { wide } = {}) =>
  (fleet.repos || []).flatMap((r) => renderRepoSection(r, { wide }))

// Pure clamp + slice. height non-finite or ≥ length → the whole array.
export const viewport = (lines, { scroll = 0, height } = {}) => {
  if (!Number.isFinite(height) || height >= lines.length)
    return { slice: lines, scroll: 0, maxScroll: 0 }
  const maxScroll = Math.max(0, lines.length - height)
  const s = Math.max(0, Math.min(scroll, maxScroll))
  return { slice: lines.slice(s, s + height), scroll: s, maxScroll }
}

export const footer = (showAll, scroll = 0, maxScroll = 0) => {
  const scrollHint = maxScroll > 0 ? ` · ↑↓ scroll [${scroll}/${maxScroll}]` : ''
  return ` q quit${scrollHint} · a ${showAll ? 'hide dead' : 'all'} · r refresh`
}

// header(1) + panels(4) + footer(1). The body fills the rest.
export const WAR_CHROME = 6

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
  } = {},
) => {
  const header = headerLine(clock, cols)
  const panels = renderPanels(fleet.totals, heatValues)
  const body = bodyLines(fleet, { wide })
  const height = Number.isFinite(rows) ? Math.max(1, rows - WAR_CHROME) : Infinity
  const vp = viewport(body, { scroll, height })
  return [header, panels, ...vp.slice, footer(showAll, vp.scroll, vp.maxScroll)].join('\n')
}

// Swap every working glyph for the current spinner frame. ◆ appears only as a
// working-row lead, so a global replace is safe and survives scrolling.
export const spinnerizeWar = (text, frame) => text.replace(/◆/g, frame)
