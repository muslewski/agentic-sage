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

const col = (s, n) => String(s ?? '').padEnd(n).slice(0, n)

export const renderBoard = (sessions, { repoId, now } = {}) => {
  const head = `SAGE board · ${repoId} · ${sessions.length} session(s)`
  if (sessions.length === 0) return `${head}\n  (no sessions)`
  const rows = sessions.map((s) => {
    const ctx =
      s.ctx_used && s.ctx_window ? `${Math.round((s.ctx_used / s.ctx_window) * 100)}%` : ''
    const touched = `${(s.touched_globs || []).length}f`
    const handoff = s.handoff_bucket === 'none' ? 'none' : `${s.handoff_bucket} ${s.handoff_age}`
    return (
      [
        col(s.session_id, 8),
        col(s.liveness, 8),
        col(s.branch || '(none)', 18),
        col(s.dirty ? 'dirty' : 'clean', 6),
        col(touched, 5),
        col(handoff, 14),
        col(ctx, 5),
      ].join('  ') +
      (s.tmux ? `  @${s.tmux}` : '') + // jumpable tmux pane (optional, P6)
      (s.row ? `  ↳ ${s.row}` : '') // adapter-named backlog row (optional)
    )
  })
  return [head, ...rows].join('\n')
}
