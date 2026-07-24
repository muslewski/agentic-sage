// sage about — compact per-session annotation for ferry / war / tools.
// Facts line is always derived from the LIVE session record (no LLM).
// Judge line comes from attachable brief session_lines only when still
// topic-relevant (fingerprint match) and not a pure facts clone.
import { collectFleet } from './fleet.mjs'
import { loadAttachableBriefs, isJudge } from './brief.mjs'
import { tmuxPanes } from './tmux.mjs'

const LIVE = new Set(['working', 'idle', 'stalled'])

/**
 * Topic fingerprint — changes when the session's "what it's about" signal moves.
 * branch | window_name | claimed_row | sorted claimed_globs
 */
export const topicFingerprint = (s) => {
  if (!s) return ''
  const globs = Array.isArray(s.claimed_globs)
    ? [...s.claimed_globs].map(String).sort()
    : []
  const parts = [
    String(s.branch || ''),
    String(s.window_name || ''),
    String(s.claimed_row || ''),
    globs.join(','),
  ]
  return parts.join('|')
}

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

/**
 * Whether a stored session_line is still topic-relevant for live session `s`.
 * - fingerprint present: must match live topicFingerprint(s)
 * - fingerprint absent (legacy): hide if text equals live facts (clone) OR
 *   if text looks like a facts line for a different claim/window (best-effort hide
 *   when live facts differ and stored text contains old claim/window tokens is hard;
 *   legacy without fingerprint: only show if text !== live facts — still can be stale
 *   narrative; prefer fingerprints)
 */
export const sessionLineStillRelevant = (row, s, liveFacts) => {
  if (!row || typeof row.text !== 'string' || !row.text.trim()) return false
  const text = row.text.trim()
  // Never show pure facts clones as "judge" awareness
  if (liveFacts && text === liveFacts) return false
  const liveFp = topicFingerprint(s)
  if (row.fingerprint) {
    return String(row.fingerprint) === liveFp
  }
  // Legacy: no fingerprint — only show if text is not a facts clone (above).
  // Still risk of stale narrative; callers should re-publish with fingerprints.
  return true
}

/** Pick matching session_line row for session. */
export const matchSessionLine = (lines, { sessionId, tmuxName } = {}) => {
  if (!Array.isArray(lines)) return null
  for (const row of lines) {
    if (!row) continue
    if (tmuxName && row.tmux && String(row.tmux) === tmuxName) return row
    if (sessionId && row.session_id && String(row.session_id) === sessionId) return row
  }
  return null
}

/**
 * Pull judge one-liner from attachable briefs' session_lines.
 * Pass live session `s` + liveFacts to enforce topic relevance.
 */
export const judgeLineFromBriefs = (briefs, { sessionId, tmuxName, s, liveFacts } = {}) => {
  const bags = [briefs?.fleet, briefs?.repo].filter(Boolean)
  for (const b of bags) {
    const row = matchSessionLine(b.session_lines, { sessionId, tmuxName })
    if (!row) continue
    if (s && !sessionLineStillRelevant(row, s, liveFacts || factsLine(s))) continue
    if (!s && liveFacts && row.text.trim() === liveFacts) continue
    return row.text.trim().slice(0, 200)
  }
  // Fallback: if this session is the judge itself, surface brief summary
  for (const b of bags) {
    if (b.summary && sessionId && b.judge_sid === sessionId) return String(b.summary).slice(0, 200)
  }
  return ''
}

/**
 * Build session_lines entries for a fleet snapshot (fact judge / publish fill).
 * Always stamps fingerprint so about can drop stale lines after topic pivots.
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
        fingerprint: topicFingerprint(s),
      })
    }
  }
  return out.slice(0, 80)
}

/**
 * Stamp fingerprints on provided session_lines from current fleet (when missing).
 * Pure over fleet; does not invent text.
 */
export const stampSessionLineFingerprints = (lines, fleet, { panes = [] } = {}) => {
  if (!Array.isArray(lines) || !lines.length) return []
  const bySid = new Map()
  const byTmux = new Map()
  for (const r of fleet?.repos || []) {
    for (const s of r.sessions || []) {
      if (s.session_id) bySid.set(String(s.session_id), s)
      const t = resolveTmuxSession(s, panes) || worktreeBase(s)
      if (t) byTmux.set(t, s)
    }
  }
  return lines
    .filter((row) => row && typeof row.text === 'string' && row.text.trim())
    .map((row) => {
      const s =
        (row.session_id && bySid.get(String(row.session_id))) ||
        (row.tmux && byTmux.get(String(row.tmux))) ||
        null
      const fingerprint = row.fingerprint || (s ? topicFingerprint(s) : undefined)
      return {
        session_id: row.session_id != null ? String(row.session_id) : '',
        tmux: row.tmux != null && String(row.tmux) ? String(row.tmux) : undefined,
        text: String(row.text).trim().slice(0, 200),
        fingerprint: fingerprint || undefined,
      }
    })
    .slice(0, 80)
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
    fingerprint: '',
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
  const fp = topicFingerprint(s)
  const judge = judgeLineFromBriefs(br, {
    sessionId: s.session_id,
    tmuxName: resolveTmuxSession(s, paneList) || tmux,
    s,
    liveFacts: facts,
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
    fingerprint: fp,
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
