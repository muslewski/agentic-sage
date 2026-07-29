// Fleet-scale LIVE readability. A 138-child wave is CORRECT on the board and
// USELESS: 138 peer rows with no hierarchy. Collapse by the coarsest identity
// the launcher gave us, but only past a budget — one human with three sessions
// must see exactly what they saw before this file existed.
//
// Pure: no fs, no clock, no imports. Every consumer (board, war, --json)
// calls the same function so the human view and the machine view agree.

const GROUP_KEYS = [
  ['lane', 'lane'],
  ['fleet_run', 'run'],
  ['parent_sid', 'parent'],
  ['agent_kind', 'kind'],
]

const groupKeyOf = (r) => {
  for (const [field, kind] of GROUP_KEYS) {
    const v = r?.[field]
    if (v) return { key: String(v), kind }
  }
  return null
}

const DEADISH = new Set(['dead', 'closed'])

export const rollupSessions = (rows = [], { budget = 12 } = {}) => {
  if (rows.length <= budget) return { rows, groups: [] }
  const buckets = new Map()
  const loose = []
  for (const r of rows) {
    const g = groupKeyOf(r)
    if (!g) {
      loose.push(r) // ungroupable: a human. Never collapse a human.
      continue
    }
    const id = `${g.kind}:${g.key}`
    if (!buckets.has(id)) buckets.set(id, { key: g.key, kind: g.kind, rows: [] })
    buckets.get(id).rows.push(r)
  }
  const groups = []
  for (const b of buckets.values()) {
    // A bucket of one is noise as a group — show the row itself.
    if (b.rows.length < 2) {
      loose.push(...b.rows)
      continue
    }
    const dead = b.rows.filter((r) => DEADISH.has(r.liveness)).length
    groups.push({
      key: b.key,
      kind: b.kind,
      label: `${b.kind}:${b.key}`,
      count: b.rows.length,
      live: b.rows.length - dead,
      dead,
      sample: b.rows.slice(0, 3).map((r) => r.session_id),
    })
  }
  groups.sort((a, b) => b.live - a.live || b.count - a.count)
  return { rows: loose, groups }
}
