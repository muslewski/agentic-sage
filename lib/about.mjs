// sage about — compact per-session annotation for ferry / war / tools.
// Facts line is always derived from the session record (no LLM).
// Judge line comes from a fresh brief's session_lines (auto-filled by
// fact judge run / optional publish), keyed by tmux session or session_id.
import { collectFleet } from './fleet.mjs'
import { loadAttachableBriefs, isJudge } from './brief.mjs'
import { tmuxPanes } from './tmux.mjs'

const LIVE = new Set(['working', 'idle', 'stalled'])

/** War-row style one-liner from a session object. Pure. */
export const factsLine = (s) => {
  if (!s) return ''
  const parts = []
  if (s.role === 'judge') parts.push('⚖ judge')
  if (s.liveness) parts.push(String(s.liveness))
  if (s.branch) parts.push(String(s.branch))
  else if (s.session_id) parts.push(String(s.session_id).slice(0, 12))
  const claim =
    s.claimed_row ||
    (Array.isArray(s.claimed_globs) && s.claimed_globs[0]) ||
    (Array.isArray(s.touched_globs) && s.touched_globs[0])
  if (claim) parts.push(`claim:${claim}`)
  if (s.window_name) parts.push(String(s.window_name))
  const line = parts.filter(Boolean).join(' · ')
  return line.length > 200 ? `${line.slice(0, 199)}…` : line
}

/** Tmux session name from a pane target like "syndcast:0". */
export const tmuxSessionOfPane = (pane) => {
  if (!pane || typeof pane !== 'string') return ''
  const i = pane.indexOf(':')
  return i >= 0 ? pane.slice(0, i) : pane
}

/**
 * Resolve tmux session name for a sage session row (best-effort).
 * Prefers s.tmux pane target; else live pane map by pid.
 */
export const resolveTmuxSession = (s, panes = []) => {
  if (s?.tmux) {
    const name = tmuxSessionOfPane(s.tmux)
    if (name) return name
  }
  if (s?.pid && panes.length) {
    const byPid = new Map(panes.map((p) => [p.panePid, p.pane]))
    // paneForPid walks parents — keep local light match first
    if (byPid.has(Number(s.pid))) return tmuxSessionOfPane(byPid.get(Number(s.pid)))
  }
  return ''
}

/** Worktree / path basename for loose match. */
export const worktreeBase = (s) => {
  const w = s?.worktree
  if (!w || typeof w !== 'string') return ''
  const trimmed = w.replace(/\/+$/, '')
  const base = trimmed.split('/').pop() || ''
  return base
}

/**
 * Find best session in fleet for a ferry/tmux session name.
 * Priority: tmux pane session match → worktree basename → window_name.
 */
export const findSessionForTmux = (fleet, tmuxName, { panes = [] } = {}) => {
  const want = String(tmuxName || '').trim()
  if (!want) return null
  const liveFirst = []
  for (const r of fleet?.repos || []) {
    for (const s of r.sessions || []) {
      liveFirst.push({ s, repoId: r.repoId, label: r.label })
    }
  }
  // Prefer live sessions
  liveFirst.sort((a, b) => {
    const al = LIVE.has(a.s.liveness) ? 0 : 1
    const bl = LIVE.has(b.s.liveness) ? 0 : 1
    return al - bl
  })

  for (const { s, repoId, label } of liveFirst) {
    const ts = resolveTmuxSession(s, panes)
    if (ts && ts === want) return { s, repoId, label, match: 'tmux' }
  }
  for (const { s, repoId, label } of liveFirst) {
    if (worktreeBase(s) === want) return { s, repoId, label, match: 'worktree' }
  }
  for (const { s, repoId, label } of liveFirst) {
    if (s.window_name && String(s.window_name) === want) return { s, repoId, label, match: 'window' }
  }
  return null
}

/** Pull judge one-liner from attachable briefs' session_lines. */
export const judgeLineFromBriefs = (briefs, { sessionId, tmuxName } = {}) => {
  const bags = [briefs?.fleet, briefs?.repo].filter(Boolean)
  for (const b of bags) {
    const lines = Array.isArray(b.session_lines) ? b.session_lines : []
    for (const row of lines) {
      if (!row || typeof row.text !== 'string' || !row.text.trim()) continue
      if (tmuxName && row.tmux && String(row.tmux) === tmuxName) return row.text.trim().slice(0, 200)
      if (sessionId && row.session_id && String(row.session_id) === sessionId)
        return row.text.trim().slice(0, 200)
    }
  }
  // Fallback: if this session is the judge itself, surface brief summary
  for (const b of bags) {
    if (b.summary && sessionId && b.judge_sid === sessionId) return String(b.summary).slice(0, 200)
  }
  return ''
}

/**
 * Build session_lines entries for a fleet snapshot (fact judge auto path).
 * Pure. Keys ferry can match: tmux session name when known.
 */
export const buildSessionLines = (fleet, { panes = [], scope = 'fleet', repoId = null } = {}) => {
  const out = []
  for (const r of fleet?.repos || []) {
    if (scope === 'repo' && repoId && r.repoId !== repoId) continue
    for (const s of r.sessions || []) {
      if (!LIVE.has(s.liveness)) continue
      if (isJudge(s)) continue
      const tmux = resolveTmuxSession(s, panes) || worktreeBase(s) || ''
      const text = factsLine(s)
      if (!text) continue
      out.push({
        session_id: s.session_id,
        tmux: tmux || undefined,
        text,
      })
    }
  }
  return out.slice(0, 80)
}

/**
 * Full about envelope for a tmux session name.
 * Always returns a complete object; found=false when no match.
 */
export const aboutTmux = (
  home,
  tmuxName,
  { now = Date.now(), panes, fleet, briefs } = {},
) => {
  const tmux = String(tmuxName || '').trim()
  const empty = {
    schema: 1,
    kind: 'sage.about',
    tmux,
    found: false,
    facts: '',
    judge: '',
    role: '',
    liveness: '',
    session_id: '',
    repo_id: null,
  }
  if (!tmux) return empty

  let fl = fleet
  try {
    fl = fl || collectFleet(home, now)
  } catch {
    return empty
  }
  let paneList = panes
  if (paneList === undefined) {
    try {
      paneList = tmuxPanes()
    } catch {
      paneList = []
    }
  }

  const hit = findSessionForTmux(fl, tmux, { panes: paneList || [] })
  if (!hit) return empty

  const { s, repoId } = hit
  let br = briefs
  if (br === undefined) {
    try {
      br = loadAttachableBriefs(home, repoId, { now })
    } catch {
      br = { repo: null, fleet: null }
    }
  }

  const facts = factsLine(s)
  const judge = judgeLineFromBriefs(br, {
    sessionId: s.session_id,
    tmuxName: resolveTmuxSession(s, paneList) || tmux,
  })

  return {
    schema: 1,
    kind: 'sage.about',
    tmux,
    found: true,
    facts,
    judge,
    role: s.role === 'judge' ? 'judge' : 'worker',
    liveness: s.liveness || '',
    session_id: s.session_id || '',
    repo_id: repoId || null,
  }
}

/** Human text for non-JSON about. */
export const renderAbout = (about) => {
  if (!about?.found) return `sage: no session matched tmux '${about?.tmux || ''}'`
  const lines = []
  if (about.facts) lines.push(about.facts)
  if (about.judge) lines.push(`⚖ ${about.judge}`)
  return lines.length ? lines.join('\n') : 'sage: session known, no lines'
}
