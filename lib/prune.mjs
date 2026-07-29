import fs from 'node:fs'
import path from 'node:path'
import { listRepos } from './control.mjs'
import { sessionsDir, eventsFile, sageHome, repoDir } from './paths.mjs'
import { isOrphanRepo } from './fleet.mjs'
import { isAlive } from './liveness.mjs'
import { askingDir, safeSid } from './asking.mjs'
import { lastToolFile } from './throttle.mjs'

const DAY_MS = 86_400_000

// Pure: decide which terminal sessions are old enough to delete. Deletes nothing.
export const planPrune = (sessions, { days = 7, now }) => {
  const cutoff = now - days * DAY_MS
  const remove = []
  const keep = []
  for (const s of sessions) {
    const terminal = s.liveness === 'closed' || s.liveness === 'dead'
    const t = s.updated_at ? Date.parse(s.updated_at) : Number.NaN
    const old = Number.isFinite(t) && t < cutoff
    if (terminal && old) remove.push(s)
    else keep.push(s)
  }
  return { remove, keep }
}

const readJsonSafe = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

// A session is prune-eligible when it is BOTH older than the threshold AND
// not live. An old-but-alive session is a long-running human — never touch it.
const isPruneEligible = (rec, { cutoff, now }) => {
  if (!rec || typeof rec !== 'object') return false
  const t = rec.updated_at ? Date.parse(rec.updated_at) : Number.NaN
  if (!Number.isFinite(t) || t >= cutoff) return false
  if (rec.status === 'closed' || rec.link_state === 'closed') return true
  if (rec.pid && isAlive(rec.pid, { startTime: rec.pid_start })) return false
  // no pid or dead pid → eligible when old
  return true
}

const truncateEvents = (file, { keepLines = 5000, dryRun = false } = {}) => {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return 0
  }
  const lines = text.split('\n')
  // trailing empty line from final newline
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  if (lines.length <= keepLines) return 0
  const drop = lines.length - keepLines
  if (!dryRun) {
    const kept = lines.slice(-keepLines).join('\n') + '\n'
    fs.writeFileSync(file, kept)
  }
  return drop
}

const collectAllSids = (home) => {
  const sids = new Set()
  for (const { repoId } of listRepos(home)) {
    let files = []
    try {
      files = fs.readdirSync(sessionsDir(home, repoId)).filter((f) => f.endsWith('.json'))
    } catch {
      continue
    }
    for (const f of files) sids.add(f.slice(0, -'.json'.length))
  }
  return sids
}

const pruneBreadcrumbs = (home, sids, { dryRun = false } = {}) => {
  let n = 0
  // asking/<sid>
  try {
    const dir = askingDir(home)
    for (const f of fs.readdirSync(dir)) {
      // reverse of safeSid is lossy; match by scanning sids' safe forms
      const matches = [...sids].some((sid) => safeSid(sid) === f)
      if (matches) continue
      if (!dryRun) {
        try {
          fs.unlinkSync(path.join(dir, f))
        } catch {
          /* ignore */
        }
      }
      n++
    }
  } catch {
    /* no asking dir */
  }
  // last-tool/<sid>
  try {
    const dir = path.join(sageHome(home), 'last-tool')
    for (const f of fs.readdirSync(dir)) {
      const matches = [...sids].some((sid) => safeSid(sid) === f)
      if (matches) continue
      if (!dryRun) {
        try {
          fs.unlinkSync(path.join(dir, f))
        } catch {
          /* ignore */
        }
      }
      n++
    }
  } catch {
    /* no last-tool dir */
  }
  return n
}

// Fleet-wide prune: every repo SAGE knows about. dryRun counts without mutating.
// Never touches a live session, even if old.
export const pruneAll = (
  home,
  { olderThanDays = 14, dryRun = false, now = Date.now(), eventsKeepLines = 5000 } = {},
) => {
  const cutoff = now - olderThanDays * DAY_MS
  let sessions = 0
  let events = 0
  let dirs = 0
  const reposTouched = new Set()

  for (const { repoId } of listRepos(home)) {
    let files = []
    try {
      files = fs.readdirSync(sessionsDir(home, repoId)).filter((f) => f.endsWith('.json'))
    } catch {
      files = []
    }
    let removedHere = 0
    for (const f of files) {
      const file = path.join(sessionsDir(home, repoId), f)
      const rec = readJsonSafe(file)
      if (!isPruneEligible(rec, { cutoff, now })) continue
      if (!dryRun) {
        try {
          fs.unlinkSync(file)
        } catch {
          continue
        }
      }
      sessions++
      removedHere++
      reposTouched.add(repoId)
    }

    // Truncate events.ndjson to trailing N lines
    const evFile = eventsFile(home, repoId)
    const dropped = truncateEvents(evFile, { keepLines: eventsKeepLines, dryRun })
    if (dropped > 0) {
      events += dropped
      reposTouched.add(repoId)
    }

    // After session deletes, remove orphan empty repo dirs
    let remaining = 0
    try {
      remaining = fs.readdirSync(sessionsDir(home, repoId)).filter((x) => x.endsWith('.json')).length
    } catch {
      remaining = 0
    }
    // dryRun: remaining includes files we would have deleted
    if (dryRun) remaining = Math.max(0, remaining - removedHere)

    if (remaining === 0 && isOrphanRepo(repoId)) {
      if (!dryRun) {
        try {
          fs.rmSync(repoDir(home, repoId), { recursive: true, force: true })
        } catch {
          /* ignore */
        }
      }
      dirs++
      reposTouched.add(repoId)
    }
  }

  // Breadcrumbs for sids that no longer have a session file
  const sids = dryRun
    ? // approximate: collect after conceptual deletes is hard in dryRun —
      // re-scan and exclude eligible ones
      (() => {
        const keep = new Set()
        for (const { repoId } of listRepos(home)) {
          let files = []
          try {
            files = fs.readdirSync(sessionsDir(home, repoId)).filter((f) => f.endsWith('.json'))
          } catch {
            continue
          }
          for (const f of files) {
            const rec = readJsonSafe(path.join(sessionsDir(home, repoId), f))
            if (!isPruneEligible(rec, { cutoff, now })) keep.add(f.slice(0, -'.json'.length))
          }
        }
        return keep
      })()
    : collectAllSids(home)

  pruneBreadcrumbs(home, sids, { dryRun })

  return {
    repos: reposTouched.size,
    sessions,
    events,
    dirs,
  }
}
