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
