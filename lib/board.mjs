// The board reader: turn P1's per-session records into a human roster. Live
// `isAlive` re-probe so a crashed session shows `dead` even if its last record
// said alive (the orphaned-claim detector). Render is pure (inject `now`).
import fs from 'node:fs'
import path from 'node:path'
import { sessionsDir } from './paths.mjs'
import { readJson } from './store.mjs'
import { isAlive, deriveLiveness } from './liveness.mjs'

const HOUR = 3600000

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
    const alive = rec.pid ? isAlive(rec.pid) : rec.alive ?? true
    const closed = rec.status === 'closed' || rec.link_state === 'closed'
    const liveness = deriveLiveness({ alive, closed, lastToolAt: rec.last_tool_at, now })
    const { bucket, age } = handoffBucket(rec.handoff_at, now)
    out.push({ ...rec, alive, liveness, handoff_bucket: bucket, handoff_age: age })
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
const zoneOf = (globs) => {
  const dirs = [...new Set((globs || []).map(dirOf).filter(Boolean))]
  if (!dirs.length) return ''
  return dirs.length === 1 ? dirs[0] : `${dirs[0]} +${dirs.length - 1}`
}
const stripAgo = (s) => String(s || '').replace(/\s*ago$/, '')

// Human-first "balanced" board: branch is the identity (not the UUID), zone is
// where they work, status carries ctx; ✎ = uncommitted, ↳ = backlog row,
// ⚠ = a dead session still holds a row (orphan). `wide` appends the short
// session id (+tmux pane) so `sage link/unlink <sid>` stays discoverable.
export const renderBoard = (sessions, { repoId, wide } = {}) => {
  const n = sessions.length
  const head = `SAGE · ${repoId} · ${n} session${n === 1 ? '' : 's'}`
  if (n === 0) return `${head}\n  (no sessions)`
  const rows = sessions.map((s) => {
    const ctx =
      s.ctx_used && s.ctx_window ? `${Math.round((s.ctx_used / s.ctx_window) * 100)}%` : ''
    const dead = s.liveness === 'dead' || s.liveness === 'closed'
    const when = s.handoff_bucket === 'none' ? '' : stripAgo(`${s.handoff_bucket} ${s.handoff_age}`)
    return {
      id: `${s.branch || '(none)'}${s.dirty ? ' ✎' : ''}`,
      status: s.liveness + (ctx ? ` · ${ctx}` : ''),
      zone: zoneOf(s.touched_globs),
      when,
      tail: `${s.row ? `↳${s.row}` : ''}${dead && s.row ? ' ⚠' : ''}`,
      wide: wide ? `${String(s.session_id || '').slice(0, 8)}${s.tmux ? ` @${s.tmux}` : ''}` : '',
    }
  })
  const w = (k) => Math.max(...rows.map((r) => r[k].length))
  const wId = w('id'), wSt = w('status'), wZo = w('zone'), wWh = w('when')
  const lines = rows.map((r) => {
    const tail = [r.tail, r.wide].filter(Boolean).join('  ')
    return `● ${padR(r.id, wId)}  ${padR(r.status, wSt)}  ${padR(r.zone, wZo)}  ${padR(r.when, wWh)}${tail ? `  ${tail}` : ''}`.replace(/\s+$/, '')
  })
  return [head, '', ...lines].join('\n')
}
