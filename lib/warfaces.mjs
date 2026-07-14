// War-room faces: LIVE · CLASH · MEMORY — pure helpers.
// Interaction mirrors token-oracle tabs (←/→); each face answers a different question.
import { clip, fit, fitBand, layoutFor } from './warroom.mjs'

const LIVE = new Set(['working', 'idle', 'stalled'])
const TERMINAL = new Set(['dead', 'closed'])
const padR = (s, n) => String(s ?? '').padEnd(n)

export const FACES = Object.freeze(['live', 'clash', 'memory'])
export const FACE_LABELS = Object.freeze({
  live: 'LIVE',
  clash: 'CLASH',
  memory: 'MEMORY',
})

export const nextFace = (face) => {
  const i = FACES.indexOf(face)
  return FACES[i < 0 ? 0 : (i + 1) % FACES.length]
}

export const prevFace = (face) => {
  const i = FACES.indexOf(face)
  return FACES[i < 0 ? 0 : (i - 1 + FACES.length) % FACES.length]
}

export const faceIndex = (face) => {
  const i = FACES.indexOf(face)
  return i < 0 ? 0 : i
}

// Live-only contested path list (in-memory). Each entry: path + sessions that touch it.
export const contestedPaths = (rows = []) => {
  const byPath = new Map()
  for (const s of rows) {
    if (!LIVE.has(s?.liveness)) continue
    for (const p of s.touched_globs || []) {
      if (!byPath.has(p)) byPath.set(p, [])
      byPath.get(p).push(s)
    }
  }
  const out = []
  for (const [path, sessions] of byPath) {
    if (sessions.length < 2) continue
    out.push({ path, sessions })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

// Fleet-wide clash model for the CLASH face.
export const buildClash = (fleet, { query = '', workingOnly = false } = {}) => {
  const q = query.trim().toLowerCase()
  const repos = []
  let pathCount = 0
  const sessionIds = new Set()
  for (const r of fleet.repos || []) {
    let paths = contestedPaths(r.sessions || [])
    if (workingOnly) {
      paths = paths.filter((p) => p.sessions.some((s) => s.liveness === 'working'))
    }
    if (q) {
      paths = paths
        .map((p) => ({
          ...p,
          sessions: p.sessions.filter((s) => {
            const hay = `${r.label} ${p.path} ${s.window_name || ''} ${s.branch || ''} ${s.session_id || ''}`
            return hay.toLowerCase().includes(q)
          }),
        }))
        .filter((p) => p.sessions.length >= 2 || (p.sessions.length >= 1 && q))
      // After filter, keep path if ≥1 match shown and originally contested, or ≥2 matches
      paths = paths.filter((p) => p.sessions.length >= 1)
    }
    if (!paths.length) continue
    pathCount += paths.length
    for (const p of paths) for (const s of p.sessions) if (s.session_id) sessionIds.add(s.session_id)
    repos.push({
      repoId: r.repoId,
      label: r.label,
      paths,
    })
  }
  return {
    repos,
    totals: {
      paths: pathCount,
      repos: repos.length,
      sessions: sessionIds.size,
    },
  }
}

// MEMORY: only terminal sessions, still grouped by repo.
export const filterMemoryFleet = (fleet) => {
  const repos = (fleet.repos || [])
    .map((r) => ({
      ...r,
      sessions: (r.sessions || [])
        .filter((s) => TERMINAL.has(s.liveness))
        .map((s) => ({ ...s, repo_id: s.repo_id || r.repoId || r.repo_id })),
    }))
    .filter((r) => r.sessions.length > 0)
  const dead = repos.reduce((n, r) => n + r.sessions.length, 0)
  return {
    repos,
    totals: {
      ...(fleet.totals || {}),
      // Face-local summary for panels
      memory_dead: dead,
      memory_repos: repos.length,
    },
  }
}

// Mid tab segment: ‹ LIVE · clash · memory › (active UPPERCASE).
export const renderTabMid = (face) => {
  const parts = FACES.map((f) => (f === face ? FACE_LABELS[f] : FACE_LABELS[f].toLowerCase()))
  return `‹ ${parts.join(' · ')} ›`
}

// Full header line: brand + tabs + clock, exactly ≤ cols (⚔ counts +1 display col).
export const renderWarHeader = (face, clock = '', cols = 80) => {
  const w = Number.isFinite(cols) && cols >= 40 ? Math.floor(cols) : 80
  const brand = '⚔  SAGE WAR'
  const brandCols = brand.length + 1 // ⚔ is 2 display cols in most terms
  let mid = renderTabMid(face)
  if (brandCols + 2 + [...mid].length + 2 + (clock ? clock.length : 0) > w) {
    mid = `‹ ${FACES.map((f) => (f === face ? FACE_LABELS[f][0] : FACE_LABELS[f][0].toLowerCase())).join(' · ')} ›`
  }
  const clockS = clock || ''
  const midCols = [...mid].length
  const clockCols = clockS.length
  let gap = w - brandCols - midCols - clockCols
  if (gap < 1) {
    // Drop clock, then clip mid
    gap = w - brandCols - midCols
    if (gap < 1) {
      const room = Math.max(4, w - brandCols - 1)
      mid = [...mid].slice(0, room).join('')
      gap = Math.max(1, w - brandCols - [...mid].length)
      return brand + ' '.repeat(gap) + mid
    }
    return brand + ' '.repeat(gap) + mid
  }
  // brand · gap/2 · mid · gap/2 · clock  — keep mid visually centered-ish
  const leftGap = Math.max(1, Math.floor(gap / 2))
  const rightGap = Math.max(1, gap - leftGap)
  return brand + ' '.repeat(leftGap) + mid + ' '.repeat(rightGap) + clockS
}

// Panels copy for each face (same box geometry as renderPanels).
export const facePanelTotals = (face, fleetTotals = {}, clashTotals = {}, memoryMeta = {}) => {
  const t = fleetTotals || {}
  if (face === 'clash') {
    return {
      repos: clashTotals.repos || 0,
      sessions: clashTotals.sessions || 0,
      live: clashTotals.sessions || 0,
      working: t.working || 0,
      contested: clashTotals.paths || 0,
      compacting: 0,
      human: clashTotals.sessions || 0,
      nested: 0,
      _clash: true,
      paths: clashTotals.paths || 0,
    }
  }
  if (face === 'memory') {
    const dead = memoryMeta.dead ?? Math.max(0, (t.sessions || 0) - (t.live || 0))
    return {
      repos: memoryMeta.repos ?? t.repos ?? 0,
      sessions: dead,
      live: 0,
      working: 0,
      contested: 0,
      compacting: 0,
      human: dead,
      nested: 0,
      _memory: true,
      dead,
    }
  }
  return { ...t, _live: true }
}

// CLASH body model: repo bands + path rows + indented session rows.
export const bodyModelClash = (clash, { cols = 80 } = {}) => {
  const L = layoutFor(cols, { showZone: false })
  const w = L.rowW
  const model = []
  const repos = clash.repos || []
  if (!repos.length) {
    const msg = padR(clip('  clear — no live contests', w), w)
    model.push({ text: msg, header: msg, isHeader: false, session: null, clashEmpty: true })
    return model
  }
  for (const r of repos) {
    const n = (r.paths || []).length
    const left = `▌ ${r.label} · ${n} path${n === 1 ? '' : 's'}`
    const head = fitBand(left, [], w)
    model.push({ text: head, header: head, isHeader: true, session: null })
    for (const p of r.paths || []) {
      const pathLine = padR(clip(`  ⚔ ${p.path}`, w), w)
      const primary = p.sessions[0] || null
      model.push({
        text: pathLine,
        header: head,
        isHeader: false,
        session: primary,
        clashPath: p.path,
        clashSessions: p.sessions,
        repo_id: r.repoId,
      })
      for (const s of p.sessions) {
        const label = `${s.window_name || '·'} · ${s.branch || '(none)'}`
        const st = s.liveness || ''
        const line = padR(clip(`      ${fit(label, Math.min(28, w - 16))}  ${st}`, w), w)
        model.push({
          text: line,
          header: head,
          isHeader: false,
          session: { ...s, repo_id: s.repo_id || r.repoId },
          clashPath: p.path,
          repo_id: r.repoId,
        })
      }
    }
  }
  return model
}
