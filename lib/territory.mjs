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

// Other sessions in this repo (board-derived: carries liveness + handoff_age).
const others = (home, repoId, now, selfSid) =>
  collectSessions(home, repoId, now).filter((s) => s.session_id !== selfSid)

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
  const head = `SAGE why-diverged · ${file}`
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
  const head = `SAGE merge-brief · ${repoId} · ${contested.length} contested path(s)`
  if (!contested.length) return `${head}\n  no contested paths — clear to merge`
  const blocks = contested.map((c) => {
    const tag = c.generated ? '  ⚠ generated — regenerate, do NOT merge' : ''
    const zone = c.zone ? `  (zone: ${c.zone})` : ''
    const who = c.sessions.map((s) => s.branch || s.session_id).join(', ')
    return `  ${c.path}${zone}${tag}\n    contested by: ${who}`
  })
  return [head, ...blocks].join('\n')
}
