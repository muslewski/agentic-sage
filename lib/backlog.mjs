// Backlog coordination (P11): the fleet races on backlog ROWS, not just file
// paths. Turn the live session records + an adapter-supplied row list into each
// row's truth — who holds it, is the holder alive, does the .md glyph drift from
// reality. PURE · AGNOSTIC · READ-ONLY: no knowledge of any .md format (the
// adapter supplies rows), no write (the holder field is stamped by bin/sage on
// the session's OWN record — the claimed_globs pattern). `✅` is human-owned (a
// remote merge SAGE can't see); SAGE asserts only the live 🟡/⬜ dimension.

// A session holds a row via an explicit claim, else the adapter's branch→row
// inference, else nothing.
export const resolveRow = (rec, inferredRow) => rec?.claimed_row || inferredRow || null

const isClosed = (s) =>
  s.status === 'closed' || s.link_state === 'closed' || s.link_state === 'unlinked'

// rows: [{ id, status, mission, lands }] from the adapter (status = the .md glyph).
// sessions: collectSessions() output, each carrying `.resolvedRow` (set by caller).
export const backlogStatus = (rows, sessions, _now) =>
  rows.map((row) => {
    const onRow = sessions.filter((s) => s.resolvedRow === row.id && !isClosed(s))
    const liveHolders = onRow.filter((s) => s.alive)
    const deadHolders = onRow.filter((s) => !s.alive)
    const md = row.status || ''
    let drift = 'none'
    if (md !== '✅') {
      if (md === '⬜' && liveHolders.length) drift = 'held-but-open'
      else if (md === '🟡' && !liveHolders.length && deadHolders.length) drift = 'orphaned'
      else if (md === '🟡' && !onRow.length) drift = 'stale-open'
    }
    return {
      id: row.id,
      mdStatus: md,
      mission: row.mission || '',
      liveHolders,
      deadHolders,
      derived: liveHolders.length ? 'held' : 'free',
      drift,
    }
  })

const DRIFT_NOTE = {
  'held-but-open': 'held by a live session — mark 🟡',
  orphaned: 'holder is dead — reclaim or reset ⬜',
  'stale-open': 'marked 🟡 but no live session',
}

const holderTag = (s) =>
  `${s.session_id}${s.branch ? `@${s.branch}` : ''}${s.tmux ? ` ⟨${s.tmux}⟩` : ''}`

// Pure render — only the actionable rows (a holder or a drift); quiet when clear.
export const renderBacklog = (statuses, { repoId } = {}) => {
  const held = statuses.filter((r) => r.liveHolders.length)
  const orphans = statuses.filter((r) => r.drift === 'orphaned').length
  const head = `SAGE backlog · ${repoId} · ${statuses.length} row(s) · ${held.length} held · ${orphans} orphaned`
  const lines = []
  for (const r of statuses) {
    if (!r.liveHolders.length && !r.deadHolders.length && r.drift === 'none') continue
    const who = r.liveHolders.length
      ? `held by ${r.liveHolders.map(holderTag).join(', ')}`
      : r.deadHolders.length
        ? `dead: ${r.deadHolders.map(holderTag).join(', ')}`
        : 'free'
    const flag = r.drift !== 'none' ? `  ⚠ ${DRIFT_NOTE[r.drift]}` : ''
    lines.push(`  ${r.id}  ${r.mdStatus || '·'}  ${who}${flag}`)
  }
  if (!lines.length) return `${head}\n  (fleet clear — no held or drifted rows)`
  return [head, ...lines].join('\n')
}
