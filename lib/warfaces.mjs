// War-room faces: LIVE · CLASH · MEMORY — pure helpers.
// Interaction mirrors token-oracle tabs (←/→); each face answers a different question.
import { clip, fit, fitBand, layoutFor } from './warroom.mjs'
import { isGenerated } from './territory.mjs'

const LIVE = new Set(['working', 'idle', 'stalled'])
const TERMINAL = new Set(['dead', 'closed'])
const LIVENESS_RANK = { working: 0, idle: 1, stalled: 2, dead: 3, closed: 4 }
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

// Best session to jump into from a clash path (hottest first).
export const pickPrimarySession = (sessions = []) => {
  if (!sessions.length) return null
  return [...sessions].sort(
    (a, b) =>
      (LIVENESS_RANK[a.liveness] ?? 9) - (LIVENESS_RANK[b.liveness] ?? 9) ||
      String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
  )[0]
}

// Live-only contested paths. Touched + claimed both count (intent + fact).
// Sorted by severity (more sessions first), then path.
export const contestedPaths = (rows = []) => {
  const byPath = new Map()
  for (const s of rows) {
    if (!LIVE.has(s?.liveness)) continue
    const paths = new Set([...(s.touched_globs || []), ...(s.claimed_globs || [])])
    for (const p of paths) {
      if (!p) continue
      let e = byPath.get(p)
      if (!e) {
        e = { list: [], ids: new Set() }
        byPath.set(p, e)
      }
      // de-dupe session on same path in O(1) (was O(k^2) via list.some)
      if (!e.ids.has(s.session_id)) {
        e.ids.add(s.session_id)
        e.list.push(s)
      }
    }
  }
  const out = []
  for (const [path, { list: sessions }] of byPath) {
    if (sessions.length < 2) continue
    const sorted = [...sessions].sort(
      (a, b) =>
        (LIVENESS_RANK[a.liveness] ?? 9) - (LIVENESS_RANK[b.liveness] ?? 9) ||
        String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
    )
    out.push({
      path,
      sessions: sorted,
      generated: isGenerated(path),
      hot: sorted.filter((s) => s.liveness === 'working').length,
    })
  }
  return out.sort(
    (a, b) => b.sessions.length - a.sessions.length || a.path.localeCompare(b.path),
  )
}

// Fleet-wide clash model for the CLASH face.
export const buildClash = (fleet, { query = '', workingOnly = false } = {}) => {
  const q = query.trim().toLowerCase()
  const repos = []
  let pathCount = 0
  const sessionIds = new Set()
  let hotPaths = 0
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
        .filter((p) => p.sessions.length >= 1)
    }
    if (!paths.length) continue
    pathCount += paths.length
    for (const p of paths) {
      if (p.hot > 0) hotPaths++
      for (const s of p.sessions) if (s.session_id) sessionIds.add(s.session_id)
    }
    // Repos with more clash paths first
    repos.push({
      repoId: r.repoId,
      label: r.label,
      paths,
    })
  }
  repos.sort((a, b) => b.paths.length - a.paths.length || a.label.localeCompare(b.label))
  return {
    repos,
    totals: {
      paths: pathCount,
      repos: repos.length,
      sessions: sessionIds.size,
      hotPaths,
    },
  }
}

// Counts for tab bar badges (always from full fleet, not face filters).
// `clashPaths` lets a caller that already ran buildClash this tick pass the
// count in — the war-room refresh builds clash once and then called this, which
// rebuilt the whole clash model a second time (a full O(fleet) pass) only to
// read one number. Pass it and we skip the rebuild.
export const faceCountsFromFleet = (fleet, deadCount, clashPaths) => {
  const live = fleet?.totals?.live ?? 0
  const clash = Number.isFinite(clashPaths)
    ? clashPaths
    : buildClash(fleet || { repos: [] }, {}).totals.paths
  const memory = Number.isFinite(deadCount)
    ? deadCount
    : (fleet?.repos || []).reduce(
        (n, r) => n + (r.sessions || []).filter((s) => TERMINAL.has(s.liveness)).length,
        0,
      )
  return { live, clash, memory }
}

// MEMORY: only terminal sessions, still grouped by repo.
export const filterMemoryFleet = (fleet) => {
  const repos = (fleet.repos || [])
    .map((r) => {
      const sessions = (r.sessions || [])
        .filter((s) => TERMINAL.has(s.liveness))
        .map((s) => ({ ...s, repo_id: s.repo_id || r.repoId || r.repo_id }))
        .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
      const ghosts = sessions.filter((s) => !s.last_prompt_at && !s.last_tool_at).length
      return { ...r, sessions, ghosts }
    })
    .filter((r) => r.sessions.length > 0)
    .sort((a, b) => b.sessions.length - a.sessions.length)
  const dead = repos.reduce((n, r) => n + r.sessions.length, 0)
  const ghosts = repos.reduce((n, r) => n + (r.ghosts || 0), 0)
  return {
    repos,
    totals: {
      ...(fleet.totals || {}),
      memory_dead: dead,
      memory_repos: repos.length,
      memory_ghosts: ghosts,
    },
  }
}

// Mid tab segment with optional counts: ‹ LIVE 12 · clash 1 · memory 609 ›
export const renderTabMid = (face, counts = null) => {
  const parts = FACES.map((f) => {
    const lab = f === face ? FACE_LABELS[f] : FACE_LABELS[f].toLowerCase()
    const n = counts?.[f]
    if (n == null || !Number.isFinite(n)) return lab
    // Active face always shows count; inactive only if non-zero (less noise)
    if (f === face || n > 0) return `${lab} ${n}`
    return lab
  })
  return `‹ ${parts.join(' · ')} ›`
}

// Full header line: brand + tabs + clock, exactly ≤ cols (⚔ counts +1 display col).
export const renderWarHeader = (face, clock = '', cols = 80, counts = null) => {
  const w = Number.isFinite(cols) && cols >= 40 ? Math.floor(cols) : 80
  const brand = '⚔  SAGE WAR'
  const brandCols = brand.length + 1 // ⚔ is 2 display cols in most terms
  let mid = renderTabMid(face, counts)
  const clockS = clock || ''
  const fits = (m) => brandCols + 2 + [...m].length + 2 + clockS.length <= w
  if (!fits(mid)) {
    // Drop zero counts on inactive
    mid = renderTabMid(face, counts ? { live: counts.live, clash: counts.clash || null, memory: counts.memory || null } : null)
  }
  if (!fits(mid)) {
    mid = `‹ ${FACES.map((f) => {
      const ch = f === face ? FACE_LABELS[f][0] : FACE_LABELS[f][0].toLowerCase()
      const n = counts?.[f]
      return f === face && n != null ? `${ch}${n}` : ch
    }).join(' · ')} ›`
  }
  if (!fits(mid)) {
    mid = `‹ ${FACE_LABELS[face] || 'LIVE'} ›`
  }
  const midCols = [...mid].length
  const clockCols = clockS.length
  let gap = w - brandCols - midCols - clockCols
  if (gap < 1) {
    gap = w - brandCols - midCols
    if (gap < 1) {
      const room = Math.max(4, w - brandCols - 1)
      mid = [...mid].slice(0, room).join('')
      gap = Math.max(1, w - brandCols - [...mid].length)
      return brand + ' '.repeat(gap) + mid
    }
    return brand + ' '.repeat(gap) + mid
  }
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
      working: clashTotals.hotPaths || 0,
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
      ghosts: memoryMeta.ghosts || 0,
    }
  }
  return { ...t, _live: true }
}

// CLASH body model: repo bands + path rows + indented session rows.
// Path row Enter targets pickPrimarySession (working first).
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
      const gen = p.generated ? ' gen' : ''
      const who = `·${p.sessions.length}`
      const hot = p.hot > 0 ? ` ${p.hot}hot` : ''
      const pathLine = padR(clip(`  ⚔ ${p.path}${gen}  ${who}${hot}`, w), w)
      const primary = pickPrimarySession(p.sessions)
      model.push({
        text: pathLine,
        header: head,
        isHeader: false,
        session: primary ? { ...primary, repo_id: primary.repo_id || r.repoId } : null,
        clashPath: p.path,
        clashSessions: p.sessions,
        repo_id: r.repoId,
      })
      for (const s of p.sessions) {
        const label = `${s.window_name || '·'} · ${s.branch || '(none)'}`
        const st = s.liveness || ''
        const mark = s.liveness === 'working' ? '◆' : '●'
        const line = padR(
          clip(`      ${mark} ${fit(label, Math.min(26, w - 18))}  ${st}`, w),
          w,
        )
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
