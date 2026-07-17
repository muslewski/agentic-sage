// The board reader: turn P1's per-session records into a human roster. Live
// `isAlive` re-probe so a crashed session shows `dead` even if its last record
// said alive (the orphaned-claim detector). Render is pure (inject `now`).
//
// Phase 5 (Child A): live-first roster, archive fold, ctx block gauge, war-grade
// column headers when an archive is folded. Pure text only — color via paint().
import fs from 'node:fs'
import path from 'node:path'
import { sessionsDir } from './paths.mjs'
import { readJson } from './store.mjs'
import { isAlive, deriveLiveness } from './liveness.mjs'

const HOUR = 3600000
const TERMINAL = new Set(['dead', 'closed'])
const GAUGE_W = 5
const GAUGE_FILL = '█'
const GAUGE_EMPTY = '░'

const humanAge = (ms) => {
  if (ms < 0) ms = 0
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export const handoffBucket = (at, now) => {
  if (!at) return { bucket: 'none', age: '—' }
  const ms = now - Date.parse(at)
  const bucket = ms < 2 * HOUR ? 'fresh' : ms < 8 * HOUR ? 'aging' : 'stale'
  return { bucket, age: humanAge(ms) }
}

export const collectSessions = (home, repoId, now) => {
  let files = []
  try {
    files = fs.readdirSync(sessionsDir(home, repoId)).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  const out = []
  for (const f of files) {
    const rec = readJson(path.join(sessionsDir(home, repoId), f))
    if (!rec) continue
    const sid = f.slice(0, -'.json'.length) // filename is the source of truth for the id
    const alive = rec.pid ? isAlive(rec.pid, { startTime: rec.pid_start }) : false
    const closed = rec.status === 'closed' || rec.link_state === 'closed'
    const liveness = deriveLiveness({
      alive,
      closed,
      lastToolAt: rec.last_tool_at,
      phase: rec.phase,
      now,
    })
    const { bucket, age } = handoffBucket(rec.handoff_at, now)
    const outRec = {
      session_id: sid,
      ...rec,
      alive,
      liveness,
      handoff_bucket: bucket,
      handoff_age: age,
    }
    if (rec.phase !== undefined) outRec.phase = rec.phase
    out.push(outRec)
  }
  out.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
  return out
}

const padR = (s, n) => String(s ?? '').padEnd(n) // no truncation (n = max width)
const dirOf = (g) => {
  const i = g.lastIndexOf('/')
  return i < 0 ? '' : g.slice(0, i + 1)
}
// zone = where a session works: the dir of its touched paths (+N if several)
export const zoneOf = (globs) => {
  const dirs = [...new Set((globs || []).map(dirOf).filter(Boolean))]
  if (!dirs.length) return ''
  return dirs.length === 1 ? dirs[0] : `${dirs[0]} +${dirs.length - 1}`
}
const stripAgo = (s) => String(s || '').replace(/\s*ago$/, '')

export const isTerminal = (s) => TERMINAL.has(s?.liveness)

// Rank live sessions: hot (working/compacting) → attention (stalled) → idle → other.
const liveRank = (s) => {
  if (s?.phase === 'compacting' || s?.liveness === 'working') return 0
  if (s?.liveness === 'stalled' || s?.liveness === 'active') return 1
  if (s?.liveness === 'idle') return 2
  return 3
}

// Split + live-first sort. Pure. Archive = dead/closed only.
export const partitionSessions = (sessions = []) => {
  const live = []
  const archive = []
  for (const s of sessions) {
    if (isTerminal(s)) archive.push(s)
    else live.push(s)
  }
  live.sort((a, b) => {
    const d = liveRank(a) - liveRank(b)
    if (d) return d
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  })
  archive.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
  return { live, archive }
}

// Compact block gauge for context % (width GAUGE_W). Pure. 0 → all empty, 100 → all fill.
export const ctxGauge = (pct, width = GAUGE_W) => {
  const w = Math.max(1, width | 0)
  if (!Number.isFinite(pct) || pct <= 0) return GAUGE_EMPTY.repeat(w)
  if (pct >= 100) return GAUGE_FILL.repeat(w)
  const filled = Math.round((pct / 100) * w)
  const n = Math.max(0, Math.min(w, filled))
  return GAUGE_FILL.repeat(n) + GAUGE_EMPTY.repeat(w - n)
}

const ctxPct = (s) => {
  const used = s?.ctx_used
  const win = s?.ctx_window
  if (!Number.isFinite(used) || !Number.isFinite(win) || win <= 0) return null
  return Math.round((used / win) * 100)
}

// Left-ellipsis zone clip (war-grade): keep the deepest path tail, never mid-clip
// garbage like "ocs/" from "docs/". Codepoint-safe. No-op when fits.
export const clipZone = (s, n) => {
  const chars = [...String(s ?? '')]
  if (!Number.isFinite(n) || n <= 0 || chars.length <= n) return chars.join('')
  if (n <= 1) return chars.slice(-Math.max(0, n)).join('')
  const m = String(s ?? '').match(/ \+\d+$/)
  if (m) {
    const budget = Math.max(1, n - [...m[0]].length)
    const path = [...String(s).slice(0, -m[0].length)]
    if (path.length <= budget) return path.join('') + m[0]
    return `…${path.slice(-(budget - 1)).join('')}${m[0]}`
  }
  return `…${chars.slice(-(n - 1)).join('')}`
}

const statusOf = (s) => (s.phase === 'compacting' ? 'compacting' : s.liveness || '')

const whenOf = (s) => {
  if (s.handoff_bucket === 'none' || !s.handoff_bucket) return ''
  // Keep "fresh 8m" style (existing tests match /fresh/); strip trailing "ago".
  return stripAgo(`${s.handoff_bucket} ${s.handoff_age || ''}`).trim()
}

const rowFields = (s, { wide, zoneWidth } = {}) => {
  const pct = ctxPct(s)
  const dead = isTerminal(s)
  const zoneRaw = zoneOf(s.touched_globs)
  const zone =
    Number.isFinite(zoneWidth) && zoneWidth > 0 ? clipZone(zoneRaw, zoneWidth) : zoneRaw
  return {
    id: `${s.branch || '(none)'}${s.dirty ? ' ✎' : ''}`,
    gauge: pct == null ? '' : ctxGauge(pct),
    status: statusOf(s) + (pct != null ? ` · ${pct}%` : ''),
    zone,
    when: whenOf(s),
    tail: `${s.row ? `↳${s.row}` : ''}${dead && s.row ? ' ⚠' : ''}`,
    wide: wide ? `${String(s.session_id || '').slice(0, 8)}${s.tmux ? ` @${s.tmux}` : ''}` : '',
    session: s,
  }
}

const formatRow = (r, widths) => {
  const { wId, wGa, wSt, wZo, wWh } = widths
  const gauge = wGa > 0 ? `${padR(r.gauge, wGa)}  ` : r.gauge ? `${r.gauge}  ` : ''
  const tail = [r.tail, r.wide].filter(Boolean).join('  ')
  return `● ${padR(r.id, wId)}  ${gauge}${padR(r.status, wSt)}  ${padR(r.zone, wZo)}  ${padR(r.when, wWh)}${tail ? `  ${tail}` : ''}`.replace(
    /\s+$/,
    '',
  )
}

const widthsOf = (rows) => {
  const w = (k) => (rows.length ? Math.max(...rows.map((r) => (r[k] || '').length)) : 0)
  return { wId: w('id'), wGa: w('gauge'), wSt: w('status'), wZo: w('zone'), wWh: w('when') }
}

const columnHeader = (widths) => {
  const { wId, wGa, wSt, wZo, wWh } = widths
  const gauge = wGa > 0 ? `${padR('CTX', wGa)}  ` : ''
  return `  ${padR('BRANCH', wId)}  ${gauge}${padR('STATUS', wSt)}  ${padR('ZONE', wZo)}  ${padR('AGE', wWh)}`.replace(
    /\s+$/,
    '',
  )
}

// Zone budget from terminal cols when provided (leave room for other columns).
const zoneBudget = (cols) => {
  if (!Number.isFinite(cols) || cols < 40) return null // unlimited → no mid-clip
  // rough: lead+branch+gauge+status+age ≈ 40; rest for zone
  return Math.max(8, Math.min(24, cols - 48))
}

// Human-first "balanced" board: branch is the identity (not the UUID), zone is
// where they work, status carries ctx; ✎ = uncommitted, ↳ = backlog row,
// ⚠ = a dead session still holds a row (orphan). `wide` appends the short
// session id (+tmux pane) so `sage link/unlink <sid>` stays discoverable.
//
// Live-first (Phase 5): when live + archive coexist and `all` is false, dead
// rows collapse to one `▸ archive (N)` line and column headers appear. Pure
// live or pure-dead boards keep the classic head/blank/rows shape so existing
// consumers (spinnerize line map, orphan flags) stay stable.
export const renderBoard = (sessions, { repoId, wide, all = false, cols } = {}) => {
  const n = sessions.length
  if (n === 0) return `SAGE · ${repoId} · 0 sessions\n  (no sessions)`

  const { live, archive } = partitionSessions(sessions)
  const fold = !all && live.length > 0 && archive.length > 0
  const shown = fold ? live : live.concat(archive)

  const head = fold
    ? `SAGE · ${repoId} · ${live.length} live · ${archive.length} archive`
    : `SAGE · ${repoId} · ${n} session${n === 1 ? '' : 's'}`

  const zBudget = zoneBudget(cols)
  const rows = shown.map((s) => rowFields(s, { wide, zoneWidth: zBudget }))
  const widths = widthsOf(rows)
  // Ensure header labels fit their columns when shown.
  if (fold) {
    widths.wId = Math.max(widths.wId, 'BRANCH'.length)
    widths.wGa = Math.max(widths.wGa, widths.wGa > 0 ? 'CTX'.length : 0)
    widths.wSt = Math.max(widths.wSt, 'STATUS'.length)
    widths.wZo = Math.max(widths.wZo, 'ZONE'.length)
    widths.wWh = Math.max(widths.wWh, 'AGE'.length)
  }

  const body = rows.map((r) => formatRow(r, widths))
  const lines = fold
    ? [head, '', columnHeader(widths), ...body, `▸ archive (${archive.length})`]
    : [head, '', ...body]

  return lines.join('\n')
}

// View concern (like color): swap the leading ● of working rows for the current
// spinner frame. Maps by scanning body lead-rows in display order (live-first /
// archive-aware), not by fixed line index — so column headers + fold lines
// don't desync the spinner. Fallback: classic sessions[i-2] for the pure
// head/blank/rows shape.
export const spinnerize = (text, sessions, frame) => {
  const { live, archive } = partitionSessions(sessions)
  // Match what renderBoard shows: fold only when both sides non-empty (and we
  // can't know `all` here — spinnerize is only used for --watch on the live
  // surface; callers pass the same session list). Prefer live-only when archive
  // exists so spinning dead rows never happen.
  const fold = live.length > 0 && archive.length > 0
  const visible = fold ? live : live.concat(archive)

  let vi = 0
  const lines = text.split('\n')
  const out = lines.map((ln) => {
    if (!ln.startsWith('● ')) return ln
    const s = visible[vi++]
    const busy = s && (s.liveness === 'working' || s.phase === 'compacting')
    return busy ? frame + ln.slice(1) : ln
  })
  return out.join('\n')
}

// Jump target for a session: worktree path (cd) + optional tmux pane hint.
// Pure string — bin/sage decides whether to attach or print.
export const jumpHint = (s) => {
  if (!s) return ''
  const lines = []
  if (s.worktree) lines.push(`cd ${s.worktree}`)
  const sid = String(s.session_id || '').slice(0, 8)
  const br = s.branch || '—'
  lines.push(`# session ${sid} (${br}) — resume in your agent`)
  if (s.tmux) lines.push(`# tmux pane ${s.tmux}`)
  return lines.join('\n')
}

// One fzf-list line per live session (sid kept at end for parse-back).
export const fzfLine = (s) => {
  const pct = ctxPct(s)
  const gauge = pct == null ? '     ' : ctxGauge(pct)
  const st = statusOf(s)
  const br = s.branch || '(none)'
  const zone = zoneOf(s.touched_globs)
  const sid = String(s.session_id || '')
  return `${gauge}  ${st.padEnd(10)}  ${br}${s.dirty ? ' ✎' : ''}  ${zone}  \t${sid}`
}
