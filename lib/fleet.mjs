import { listRepos } from './control.mjs'
import { collectSessions } from './board.mjs'
import { mergeBrief } from './territory.mjs'

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

// Cross-repo roll-up: every judged repo's sessions + fleet totals. Pure over
// the fs (reads via listRepos/collectSessions/mergeBrief); inject `now`. A repo
// that fails to read contributes an empty section — never throws.
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
    let contested = 0
    try {
      contested = mergeBrief(home, repoId, { now }).length
    } catch {
      contested = 0
    }
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
