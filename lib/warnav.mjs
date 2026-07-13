// Pure navigation + filtering for the interactive war-room cockpit. The cursor
// is an ORDINAL over selectable (session) rows so movement is a clamped ±1,
// independent of the repo bands interleaved in the body model. Pure; the
// raw-mode shell (bin/sage) owns all state + side effects.

// Model indices that are selectable (session rows, not repo bands).
export const selectableIndices = (model) =>
  model.reduce((acc, m, i) => {
    if (!m.isHeader) acc.push(i)
    return acc
  }, [])

// Clamp an ordinal move into [0, count-1]; 0 when nothing is selectable.
export const moveSelection = (count, ord, delta) => {
  if (count <= 0) return 0
  return Math.max(0, Math.min(count - 1, ord + delta))
}

// Ordinal → model index (null when there are no selectable rows).
export const selectedModelIndex = (model, ord) => {
  const idxs = selectableIndices(model)
  if (!idxs.length) return null
  return idxs[Math.max(0, Math.min(idxs.length - 1, ord))]
}

// New scroll so model[idx] renders, reserving the top view-row for a (possibly
// pinned) repo band — so the sticky header never hides the selected row.
export const ensureVisible = (idx, scroll, height, len) => {
  if (!Number.isFinite(height) || height <= 0) return 0
  const maxScroll = Math.max(0, len - height)
  let next = scroll
  if (idx <= scroll) next = Math.max(0, idx - 1)
  else if (idx >= scroll + height) next = idx - height + 1
  return Math.max(0, Math.min(next, maxScroll))
}

// Filter the fleet by a substring query (repo label + branch) and/or working-
// only. Totals stay fleet-wide (the stat panels always summarise the whole
// fleet); only the body subset narrows. Repos emptied by the filter drop out.
export const matchFleet = (fleet, { query = '', workingOnly = false } = {}) => {
  const q = query.trim().toLowerCase()
  if (!q && !workingOnly) return fleet
  const repos = (fleet.repos || [])
    .map((r) => ({
      ...r,
      sessions: r.sessions.filter(
        (s) =>
          (!workingOnly || s.liveness === 'working') &&
          (!q || `${r.label} ${s.branch || ''}`.toLowerCase().includes(q)),
      ),
    }))
    .filter((r) => r.sessions.length > 0)
  return { repos, totals: fleet.totals }
}

// A session is killable (removable from the board) only when terminal — a dead
// or closed record with no live process. Live sessions are never removed here.
export const isKillable = (s) => !!s && (s.liveness === 'dead' || s.liveness === 'closed')

// Every terminal session across the fleet, flattened. Each keeps its repo_id +
// session_id so the caller can resolve sessionFile() and delete the record.
export const collectDead = (fleet) =>
  (fleet.repos || []).flatMap((r) => (r.sessions || []).filter(isKillable))
