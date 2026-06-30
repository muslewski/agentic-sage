// Resolve the CURRENT session's id — so a `sage claim` run from inside a Claude
// session can write claimed_globs onto its OWN record without depending on an
// undocumented harness env var. Two strategies:
//   1. SAGE_SELF_SID env override (explicit; also honored by territory/fleet).
//   2. Walk this process's parent-pid chain and match an ancestor against a
//      record's `pid` (the Claude process the hook captured). Reuses P6 ppidOf.
import { collectSessions } from './board.mjs'
import { ppidOf } from './tmux.mjs'

export const resolveSelfSid = (home, repoId, { pid = process.pid, env = process.env } = {}) => {
  if (env?.SAGE_SELF_SID) return env.SAGE_SELF_SID

  // collectSessions re-probes isAlive and sorts newest-first. Skip closed/dead
  // records (a recycled pid must not resolve self to a stale session); on a pid
  // collision keep the newest (set-if-absent over the newest-first list).
  const byPid = new Map()
  for (const s of collectSessions(home, repoId, Date.now())) {
    const closed = s.status === 'closed' || s.link_state === 'closed' || s.liveness === 'closed'
    if (closed || s.alive === false) continue
    if (s.pid && !byPid.has(Number(s.pid))) byPid.set(Number(s.pid), s.session_id)
  }
  if (!byPid.size) return null

  let cur = Number(pid)
  for (let hop = 0; hop < 30 && cur > 1; hop++) {
    if (byPid.has(cur)) return byPid.get(cur)
    cur = ppidOf(cur)
  }
  return null
}
