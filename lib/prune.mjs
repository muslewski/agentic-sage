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
