import { listRepos } from './control.mjs'
import { collectSessions } from './board.mjs'

// One-line fleet summary for the SessionStart brief + `sage fleet`. Pure.
// Names the most-recently-active OTHER live session + what it touches — the
// "nearest neighbour" glance. Empty when you're solo (caller prints nothing).
const DEAD = new Set(['closed', 'dead'])

export const fleetLine = (sessions, { selfSid } = {}) => {
  const others = sessions
    .filter((s) => s.session_id !== selfSid && !DEAD.has(s.liveness))
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
  if (!others.length) return ''
  const n = others[0]
  const path = n.touched_globs?.[0] || '—'
  return `${others.length} live · nearest ${n.branch || n.session_id} touches ${path}`
}

const LIVE = new Set(['working', 'idle', 'stalled'])
const DEADSET = new Set(['dead', 'closed'])

export const isNested = (s) => s?.managed_by === 'nested'

// Pure roll-up of a repo's rows → the counts the panels/bands show.
// Live-first: human/nested/working/compacting are over LIVE rows only so the
// cockpit never headlines 500 dead /clear re-ids as "human". `working` includes
// compacting (deriveLiveness maps phase→working for collision hotness);
// `compacting` is the explicit subset for the HEAT face (additive, zero-herald safe).
export const tally = (rows) => {
  const liveRows = rows.filter((s) => LIVE.has(s.liveness))
  const live = liveRows.length
  const working = liveRows.filter((s) => s.liveness === 'working').length
  const nested = liveRows.filter(isNested).length
  const compacting = liveRows.filter((s) => s.phase === 'compacting').length
  return { live, working, nested, human: live - nested, compacting }
}

const stripHash = (id) => id.replace(/-[0-9a-f]{8}$/, '')
const LIVENESS_RANK = { working: 0, idle: 1, stalled: 2, dead: 3, closed: 4 }
const latestActivity = (repo) =>
  repo.sessions.reduce((m, s) => {
    const t = Date.parse(s.updated_at || '')
    return Number.isFinite(t) && t > m ? t : m
  }, -Infinity)

// Live-only path contention count from rows already in memory — NEVER re-read
// the session store (mergeBrief used to re-collectSessions per repo and doubled
// war-room refresh cost to ~1.4s on a 600-session fleet).
export const contestedCount = (rows = []) => {
  const byPath = new Map()
  for (const s of rows) {
    if (!LIVE.has(s?.liveness)) continue
    for (const p of s.touched_globs || []) {
      byPath.set(p, (byPath.get(p) || 0) + 1)
    }
  }
  let n = 0
  for (const c of byPath.values()) if (c >= 2) n++
  return n
}

// Cross-repo roll-up: every judged repo's sessions + fleet totals. Pure over
// the fs (reads via listRepos/collectSessions); inject `now`. A repo that fails
// to read contributes an empty section — never throws.
export const collectFleet = (home, now = Date.now()) => {
  const repos = []
  const totals = {
    repos: 0,
    sessions: 0,
    live: 0,
    working: 0,
    contested: 0,
    human: 0,
    nested: 0,
    compacting: 0,
  }
  for (const { repoId } of listRepos(home)) {
    let rows = []
    try {
      rows = collectSessions(home, repoId, now)
    } catch {
      rows = []
    }
    const { live, working, nested, human, compacting } = tally(rows)
    const contested = contestedCount(rows)
    repos.push({
      repoId,
      label: stripHash(repoId),
      sessions: rows,
      live,
      working,
      human,
      nested,
      compacting,
    })
    totals.sessions += rows.length
    totals.live += live
    totals.working += working
    totals.human += human
    totals.nested += nested
    totals.contested += contested
    totals.compacting += compacting || 0
  }
  totals.repos = repos.length
  return { repos, totals }
}

// Display filter: hide dead/closed sessions and then repos left with none.
// `showAll` returns the fleet untouched. `totals` are the FLEET summary and are
// preserved regardless (panels show the whole fleet; the body shows the subset).
export const filterFleet = (fleet, { showAll = false } = {}) => {
  if (showAll) return fleet
  const repos = fleet.repos
    .map((r) => ({ ...r, sessions: r.sessions.filter((s) => !DEADSET.has(s.liveness)) }))
    .filter((r) => r.sessions.length > 0)
  return { repos, totals: fleet.totals }
}

// Stable ordering: hottest repo first; within a repo, most-active session first.
export const sortFleet = (fleet) => {
  const repos = fleet.repos
    .map((r) => ({
      ...r,
      sessions: [...r.sessions].sort(
        (a, b) =>
          (LIVENESS_RANK[a.liveness] ?? 9) - (LIVENESS_RANK[b.liveness] ?? 9) ||
          String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
      ),
    }))
    .sort((a, b) => latestActivity(b) - latestActivity(a))
  return { repos, totals: fleet.totals }
}

// ── Phase 5 Child B: repos atlas + composable HUD ───────────────────────────

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
const sparkline = (values = []) => {
  const v = values.filter((x) => Number.isFinite(x))
  if (!v.length) return ''
  const max = Math.max(...v, 1)
  return v
    .map((x) => SPARK[Math.min(SPARK.length - 1, Math.round((x / max) * (SPARK.length - 1)))])
    .join('')
}

const blockGauge = (pct, width = 5) => {
  const w = Math.max(1, width | 0)
  const p = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
  if (p <= 0) return '░'.repeat(w)
  if (p >= 100) return '█'.repeat(w)
  const n = Math.round((p / 100) * w)
  return '█'.repeat(n) + '░'.repeat(w - n)
}

// Subagent / harness scratch repos are "orphan" noise on the product atlas.
// Match the audit's `subagent-<uuid>` dump pattern; product repos keep their name.
export const isOrphanRepo = (repoId) => {
  const id = String(repoId || '')
  if (/^subagent[-_]/i.test(id)) return true
  // bare UUID-ish agent scratch: 8-4-4-4-12 with optional hash suffix stripped already
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(id)) return true
  return false
}

// Activity spark over the last window (default 24h, 8 buckets). Pure.
export const activitySpark = (timestamps = [], { now = Date.now(), buckets = 8, windowMs = 24 * 3600000 } = {}) => {
  const n = Math.max(1, buckets | 0)
  const counts = Array(n).fill(0)
  const start = now - windowMs
  const bucketMs = windowMs / n
  for (const t of timestamps) {
    const ms = typeof t === 'number' ? t : Date.parse(t)
    if (!Number.isFinite(ms) || ms < start || ms > now) continue
    let i = Math.floor((ms - start) / bucketMs)
    if (i < 0) i = 0
    if (i >= n) i = n - 1
    counts[i]++
  }
  if (counts.every((c) => c === 0)) return ''
  return sparkline(counts)
}

// Live-session gauge: live/total as a compact block bar.
export const liveGauge = (live, total, width = 5) => {
  if (!total || total <= 0) return '░'.repeat(Math.max(1, width | 0))
  return blockGauge((live / total) * 100, width)
}

// Pure view over a collectFleet result for `sage repos`.
export const buildReposView = (fleet, { now = Date.now() } = {}) => {
  const rows = (fleet?.repos || []).map((r) => {
    const sessions = r.sessions || []
    const total = sessions.length
    const live = r.live ?? sessions.filter((s) => LIVE.has(s.liveness)).length
    const ts = sessions.map((s) => s.updated_at).filter(Boolean)
    return {
      repoId: r.repoId,
      label: r.label || stripHash(r.repoId),
      sessions: total,
      live,
      working: r.working ?? 0,
      gauge: liveGauge(live, total),
      spark: activitySpark(ts, { now }),
      orphan: isOrphanRepo(r.repoId),
    }
  })
  // Hot product first (live desc, then session count).
  const rank = (a, b) => b.live - a.live || b.sessions - a.sessions || a.label.localeCompare(b.label)
  const product = rows.filter((r) => !r.orphan).sort(rank)
  const orphan = rows.filter((r) => r.orphan).sort(rank)
  return { product, orphan, now }
}

const padR = (s, n) => String(s ?? '').padEnd(n)

export const renderRepos = (view, { all = false } = {}) => {
  const product = view?.product || []
  const orphan = view?.orphan || []
  if (!product.length && !orphan.length) return 'sage: no judged repos yet'

  const head = `SAGE repos · ${product.length} product · ${orphan.length} orphan${orphan.length ? (all ? '' : ' ▾') : ''}`
  const wName = Math.max(8, ...product.concat(all ? orphan : []).map((r) => r.label.length), 0)

  const rowLine = (r) => {
    const live = r.live > 0 ? `live ${r.live}` : 'idle'
    const spark = r.spark ? `  ${r.spark}` : ''
    // Keep full repoId on the line so existing CLI consumers/tests that match
    // the id still work (old grammar: `name (repoId · N session(s))`).
    return `  ${padR(r.label, wName)}  ${r.gauge}  ${padR(live, 8)}${spark}  (${r.repoId} · ${r.sessions} session(s))`
  }

  const lines = [head]
  if (product.length) {
    lines.push(...product.map(rowLine))
  } else {
    lines.push('  (no product repos)')
  }
  if (orphan.length) {
    if (all) {
      lines.push(`▸ orphans (${orphan.length})`)
      lines.push(...orphan.map(rowLine))
    } else {
      lines.push(`▸ orphans (${orphan.length})`)
    }
  }
  return lines.join('\n')
}

export const fzfRepoLine = (r) => {
  const live = r.live > 0 ? `live ${r.live}` : 'idle'
  const spark = r.spark || ''
  return `${r.gauge || '     '}  ${live.padEnd(8)}  ${r.label || r.repoId}  ${spark}\t${r.repoId}`
}

// Join non-empty HUD chips. Never emits empty segments or double separators.
export const composeHud = (parts = []) =>
  parts
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter((p) => p.length > 0)
    .join(' · ')

// Human fleet HUD: live count, contested ⚔, nearest neighbour, optional self
// ctx gauge + asking pulse. Empty chips are never rendered. Pure — fleetLine
// stays the SessionStart brief (byte-stable).
export const fleetHud = (sessions = [], { selfSid, asking = false, contested } = {}) => {
  const DEAD = new Set(['closed', 'dead'])
  const others = sessions.filter((s) => s.session_id !== selfSid && !DEAD.has(s.liveness))
  const liveN = others.length
  const self = selfSid ? sessions.find((s) => s.session_id === selfSid) : null

  let clash = contested
  if (clash == null) {
    // Contested among live peers (include self for path collision awareness).
    const liveRows = sessions.filter((s) => !DEAD.has(s.liveness))
    clash = contestedCount(liveRows)
  }

  const nearest = (() => {
    if (!others.length) return ''
    const sorted = [...others].sort((a, b) =>
      String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
    )
    const n = sorted[0]
    const path = n.touched_globs?.[0] || '—'
    return `nearest ${n.branch || n.session_id} touches ${path}`
  })()

  const ctxChip = (() => {
    if (!self) return ''
    const used = self.ctx_used
    const win = self.ctx_window
    if (!Number.isFinite(used) || !Number.isFinite(win) || win <= 0) return ''
    const pct = Math.round((used / win) * 100)
    return `ctx ${blockGauge(pct)} ${pct}%`
  })()

  const chips = [
    liveN > 0 ? `${liveN} live` : '',
    clash > 0 ? `${clash} ⚔` : '',
    nearest,
    ctxChip,
    asking ? '⚖ Asking Sage' : '',
  ]
  return composeHud(chips)
}
