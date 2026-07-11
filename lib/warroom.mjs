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

// One fixed-width box (top border with title, N content rows, bottom border).
const box = (title, rows, w) => {
  const top = `┌─ ${title} ${'─'.repeat(Math.max(0, w - title.length - 3))}┐`
  const body = rows.map((r) => `│ ${padR(r, w - 2)}│`)
  const bot = `└${'─'.repeat(w)}┘`
  return [top, ...body, bot]
}

const W_FLEET = 16
const W_ACTIVE = 16
const W_HEAT = 34

// Three side-by-side panels as one 4-line block.
export const renderPanels = (totals = {}, heatValues = []) => {
  const t = { repos: 0, sessions: 0, live: 0, working: 0, contested: 0, ...totals }
  const fleet = box('FLEET', [`${t.repos} repos`, `${t.sessions} sessions`], W_FLEET)
  const active = box('ACTIVE', [`${t.live} live`, `${t.working} working`], W_ACTIVE)
  const spark = sparkline(heatValues)
  const heat = box(
    'HEAT',
    [
      `${spark ? `${spark}  ` : ''}${t.working} hot`,
      `contested: ${t.contested} file${t.contested === 1 ? '' : 's'}`,
    ],
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
  return `  ${lead} ${padR(id, 18)} ${padR(s.liveness + ctx, 14)} ${padR(zone, 16)} ${padR(when, 10)}${tail ? ` ${tail}` : ''}${idw}`.replace(
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

export const renderWarRoom = (
  fleet,
  { showAll = false, heatValues = [], scroll = 0, rows = Infinity, wide = false, clock = '' } = {},
) => {
  const header = `⚔  SAGE WAR ROOM${clock ? `                          ${clock}` : ''}`
  const panels = renderPanels(fleet.totals, heatValues)
  const body = bodyLines(fleet, { wide })
  const height = Number.isFinite(rows) ? Math.max(1, rows - WAR_CHROME) : Infinity
  const vp = viewport(body, { scroll, height })
  return [header, panels, ...vp.slice, footer(showAll, vp.scroll, vp.maxScroll)].join('\n')
}

// Swap every working glyph for the current spinner frame. ◆ appears only as a
// working-row lead, so a global replace is safe and survives scrolling.
export const spinnerizeWar = (text, frame) => text.replace(/◆/g, frame)
