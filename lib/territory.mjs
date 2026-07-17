// Territory + conflict: read-only overlap detection over P1 records. Pure logic
// (no git, no writes) — the optional tier-2 numstat lives in lib/git.mjs. Globs:
// `touched_globs` are concrete paths; `claimed_globs` + queries are globs; so
// overlap is bidirectional path-or-glob (spec §3). Project-agnostic: no adapter,
// names branches + globs only. `claimed_globs` is absent until P7 registers it,
// so every builder always unions `touched_globs` and is useful today.
import { collectSessions } from './board.mjs'

// Only `*` and `?` are wildcards. `[ ] { }` are treated as LITERAL path chars —
// concrete paths in app-router trees (`[channelSlug]`, `[...view]`) are full of
// them, and a guard that blocks an edit must not misread a bracketed dir as a
// regex char-class (would both over-block siblings and fail to match itself).
const MAGIC = /[*?]/

export const globToRegExp = (glob) => {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++
        if (glob[i + 1] === '/') {
          i++
          re += '(?:.*/)?' // **/ → zero-or-more dirs
        } else re += '.*'
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape `[` `]` too → literal brackets
  }
  return new RegExp(`^${re}$`)
}

// Everything before a glob's first magic char (trailing slash trimmed).
const staticPrefix = (glob) => {
  const m = glob.match(MAGIC)
  const p = m ? glob.slice(0, m.index) : glob
  return p.replace(/\/+$/, '')
}

// Everything after a glob's LAST magic char (the fixed tail, e.g. `.ts` for
// `*.ts`, `` for `src/**`). Lets two prefix-compatible globs be told apart by an
// incompatible suffix — `*.ts` vs `*.md` share an empty prefix but cannot match
// a common path.
const staticSuffix = (glob) => {
  let last = -1
  for (let i = 0; i < glob.length; i++) if (MAGIC.test(glob[i])) last = i
  return glob.slice(last + 1)
}

export const overlaps = (a, b) => {
  const ma = MAGIC.test(a)
  const mb = MAGIC.test(b)
  if (!ma && !mb) return a === b
  if (ma && !mb) return globToRegExp(a).test(b)
  if (!ma && mb) return globToRegExp(b).test(a)
  // both globs: pragmatic overlap = compatible static prefix AND static suffix.
  // (Suffix is vacuously compatible whenever either ends in a magic char, e.g.
  // `src/**`, so it only discriminates the empty/equal-prefix case.)
  const pa = staticPrefix(a)
  const pb = staticPrefix(b)
  if (!(pa.startsWith(pb) || pb.startsWith(pa))) return false
  const sa = staticSuffix(a)
  const sb = staticSuffix(b)
  return sa.endsWith(sb) || sb.endsWith(sa)
}

const GEN_LOCKS = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'Cargo.lock',
  'poetry.lock',
  'composer.lock',
  'Gemfile.lock',
  'go.sum',
])
const GEN_DIRS = ['dist/', 'build/', 'out/', '.next/', 'coverage/', 'node_modules/', 'vendor/']

// Core (project-agnostic) generated-file heuristic. P5's adapter extends it via
// `extraGlobs` (e.g. payload-types.ts, importMap.js, the Mind index, manifests).
export const isGenerated = (p, extraGlobs = []) => {
  const base = p.split('/').pop()
  if (GEN_LOCKS.has(base) || base.endsWith('.lock')) return true
  if (p.includes('.generated.') || p.includes('.min.')) return true
  if (GEN_DIRS.some((d) => p.includes(d))) return true
  return extraGlobs.some((g) => overlaps(g, p))
}

export const claimsOf = (rec) => ({
  claimed: rec.claimed_globs ?? [],
  touched: rec.touched_globs ?? [],
})

// Live-only peers. Dead/closed history is storage noise, not a collision surface —
// counting it made merge-brief / war HEAT cry wolf (hundreds of "contested" paths
// from /clear ghosts). working | idle | stalled are the only sessions that can
// still collide with you.
const LIVE = new Set(['working', 'idle', 'stalled'])
const others = (home, repoId, now, selfSid) =>
  collectSessions(home, repoId, now).filter(
    (s) => s.session_id !== selfSid && LIVE.has(s.liveness),
  )

// Who else claims (intent) or touches (fact) any of the queried globs.
export const territory = (home, repoId, queries, { now, selfSid } = {}) => {
  const out = []
  for (const s of others(home, repoId, now, selfSid)) {
    const { claimed, touched } = claimsOf(s)
    for (const q of queries) {
      const tHit = touched.find((g) => overlaps(q, g))
      const cHit = claimed.find((g) => overlaps(q, g))
      const hit = tHit ?? cHit
      if (!hit) continue
      out.push({
        session_id: s.session_id,
        branch: s.branch ?? null,
        query: q,
        hit,
        via: tHit ? 'touched' : 'claimed',
        liveness: s.liveness,
        handoff_age: s.handoff_age,
        generated: isGenerated(hit),
      })
    }
  }
  return out
}

// Which sessions' territory includes a specific file (intent or fact).
export const whyDiverged = (home, repoId, file, { now, selfSid } = {}) => {
  const out = []
  for (const s of others(home, repoId, now, selfSid)) {
    const { claimed, touched } = claimsOf(s)
    const inTouched = touched.some((g) => overlaps(g, file))
    const inClaimed = claimed.some((g) => overlaps(g, file))
    if (!inTouched && !inClaimed) continue
    out.push({
      session_id: s.session_id,
      branch: s.branch ?? null,
      via: inTouched ? 'touched' : 'claimed',
      liveness: s.liveness,
      handoff_age: s.handoff_age,
      worktree: s.worktree ?? null,
      generated: isGenerated(file),
    })
  }
  return out
}

// Every path two or more sessions have touched — the conflict surface.
// `extraGlobs` (adapter-supplied) widen the generated-file check (P5).
export const mergeBrief = (home, repoId, { now, selfSid, extraGlobs = [] } = {}) => {
  const byPath = new Map()
  for (const s of others(home, repoId, now, selfSid)) {
    for (const p of claimsOf(s).touched) {
      if (!byPath.has(p)) byPath.set(p, [])
      byPath.get(p).push({
        session_id: s.session_id,
        branch: s.branch ?? null,
        via: 'touched',
        liveness: s.liveness,
      })
    }
  }
  const out = []
  for (const [p, sessions] of byPath) {
    if (sessions.length < 2) continue
    out.push({ path: p, generated: isGenerated(p, extraGlobs), sessions })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

const pad = (s, n) =>
  String(s ?? '')
    .padEnd(n)
    .slice(0, n)

// Heat sparkline (U+2581–2588) — same ladder as warroom, inlined so territory
// stays free of a warroom import cycle.
const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
const sparkline = (values = []) => {
  const v = values.filter((x) => Number.isFinite(x))
  if (!v.length) return ''
  const max = Math.max(...v, 1)
  return v
    .map((x) => SPARK[Math.min(SPARK.length - 1, Math.round((x / max) * (SPARK.length - 1)))])
    .join('')
}

const LIVE_HEAT = { working: 3, stalled: 2, idle: 1, active: 3 }
const riskBar = (score, width = 4) => {
  const w = Math.max(1, width | 0)
  const p = Math.max(0, Math.min(100, score))
  if (p <= 0) return '░'.repeat(w)
  if (p >= 100) return '█'.repeat(w)
  const n = Math.round((p / 100) * w)
  return '█'.repeat(n) + '░'.repeat(w - n)
}

// Per-path risk: session count + working hotness + generated penalty.
// Returns { score 0–100, level: low|medium|high, label, bar }.
export const pathRisk = (entry = {}) => {
  const sessions = entry.sessions || []
  const n = sessions.length
  const working = sessions.filter((s) => s.liveness === 'working' || s.liveness === 'active').length
  const stalled = sessions.filter((s) => s.liveness === 'stalled').length
  let score = 0
  if (n >= 2) score += 25
  if (n >= 3) score += 20
  if (n >= 4) score += 15
  score += Math.min(30, working * 12 + stalled * 6)
  if (entry.generated) score += 25
  score = Math.max(0, Math.min(100, score))
  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  return { score, level, label: level, bar: riskBar(score) }
}

// Aggregate risk for a list of contested paths (header chip).
export const briefRisk = (contested = []) => {
  if (!contested.length) return { score: 0, level: 'low', label: 'clear', bar: riskBar(0) }
  const scores = contested.map((c) => pathRisk(c).score)
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  // Bump for generated paths + high path count.
  const gen = contested.filter((c) => c.generated).length
  const bumped = Math.min(100, score + Math.min(20, gen * 8) + (contested.length >= 5 ? 10 : 0))
  const level = bumped >= 70 ? 'high' : bumped >= 40 ? 'medium' : 'low'
  return { score: bumped, level, label: level, bar: riskBar(bumped) }
}

// Per-path heat spark from session liveness ranks (one bar per session).
export const pathHeat = (sessions = []) => {
  if (!sessions.length) return ''
  const vals = sessions.map((s) => LIVE_HEAT[s?.liveness] ?? 0)
  return sparkline(vals)
}

// fzf list line: display · tab · path (parse-back for drill-in).
export const fzfPathLine = (c) => {
  const risk = pathRisk(c)
  const heat = pathHeat(c.sessions || [])
  const who = (c.sessions || []).map((s) => s.branch || s.session_id).join(',')
  const gen = c.generated ? ' ⚠gen' : ''
  return `${risk.bar} ${risk.level.padEnd(6)}  ${c.path}${gen}  ${heat}  ${who}\t${c.path}`
}

export const renderTerritory = (overlapped, { queries } = {}) => {
  const head = `SAGE territory · ${(queries || []).join(' ')}`
  if (!overlapped.length) return `${head}\n  clear — no other session claims or touches this`
  const rows = overlapped.map(
    (o) =>
      `  ${pad(o.branch || o.session_id, 18)} ${pad(o.via, 8)} ${pad(o.liveness, 8)} ${o.hit}${o.zone ? `  (zone: ${o.zone})` : ''}${o.generated ? '  [generated]' : ''}`,
  )
  return [head, ...rows].join('\n')
}

export const renderWhyDiverged = (touches, { file } = {}) => {
  // Treat touches as a single "path" for risk/heat (sessions shape matches).
  const asPath = {
    path: file,
    generated: touches.some((t) => t.generated),
    sessions: touches,
  }
  const risk = pathRisk(asPath)
  const heat = pathHeat(touches)
  const riskChip = touches.length
    ? ` · RISK ${risk.bar} ${risk.level}${heat ? ` · ${heat}` : ''}`
    : ''
  const head = `SAGE why-diverged · ${file}${riskChip}`
  if (!touches.length) return `${head}\n  no other session touches this file`
  const rows = touches.map((t) => {
    const stat = t.stat?.length ? `  +${t.stat[0].added}/-${t.stat[0].deleted}` : ''
    return `  ${pad(t.branch || t.session_id, 18)} ${pad(t.via, 8)} ${pad(t.liveness, 8)}${stat}${t.zone ? `  (zone: ${t.zone})` : ''}`
  })
  const foot = touches.some((t) => t.generated)
    ? ['', '  ⚠ generated file — regenerate from source, do NOT hand-merge']
    : []
  return [head, ...rows, ...foot].join('\n')
}

export const renderMergeBrief = (contested, { repoId } = {}) => {
  const risk = briefRisk(contested)
  const genN = contested.filter((c) => c.generated).length
  const genChip = genN ? ` · ${genN} gen ⚠` : ''
  const head = contested.length
    ? `SAGE merge-brief · ${repoId} · RISK ${risk.bar} ${risk.level} · ${contested.length} contested path(s)${genChip}`
    : `SAGE merge-brief · ${repoId} · ${contested.length} contested path(s)`
  if (!contested.length) return `${head}\n  no contested paths — clear to merge`
  const blocks = contested.map((c) => {
    const pr = pathRisk(c)
    const heat = pathHeat(c.sessions || [])
    const tag = c.generated ? '  ⚠ generated — regenerate, do NOT merge' : ''
    const zone = c.zone ? `  (zone: ${c.zone})` : ''
    const who = c.sessions.map((s) => s.branch || s.session_id).join(', ')
    const spark = heat ? `  ${heat}` : ''
    return `  ${c.path}${zone}  ${pr.bar} ${pr.level}${spark}${tag}\n    contested by: ${who}`
  })
  return [head, ...blocks].join('\n')
}
