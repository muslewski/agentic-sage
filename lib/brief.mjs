// Live-judge continuous briefs — store-native advisory narrative layered on
// top of deterministic CLI facts. Zero LLM here: validate, atomic write, TTL
// freshness, render. Fail-open readers return null/empty.
import fs from 'node:fs'
import path from 'node:path'
import { fleetBriefFile, repoBriefFile } from './paths.mjs'
import { readRecord } from './store.mjs'
import { isAlive } from './liveness.mjs'

export const DEFAULT_TTL_MS = 120_000
/** After the judge process dies (or role clears), still attach a brief this long. */
export const DEFAULT_GRACE_MS = 30_000
export const MAX_ANALYSIS_CHARS = 8_000
export const MAX_SUMMARY_CHARS = 400

export { fleetBriefFile, repoBriefFile }

export const isJudge = (s) => s?.role === 'judge'

export const briefPathFor = (home, scope, repoId) =>
  scope === 'fleet' ? fleetBriefFile(home) : repoBriefFile(home, repoId)

const LIVE = new Set(['working', 'idle', 'stalled'])

export const readBriefFile = (file) => {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const j = JSON.parse(raw)
    if (!j || j.kind !== 'sage.brief' || j.schema !== 1) return null
    return j
  } catch {
    return null
  }
}

export const writeBriefFile = (file, brief) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(brief, null, 2)}\n`)
  fs.renameSync(tmp, file)
}

/** Soft-cap prose fields; return a new object (does not mutate input). */
export const normalizeBrief = (input, { now = Date.now() } = {}) => {
  const scope = input.scope === 'fleet' ? 'fleet' : 'repo'
  let analysis = String(input.analysis ?? '')
  if (analysis.length > MAX_ANALYSIS_CHARS) analysis = `${analysis.slice(0, MAX_ANALYSIS_CHARS)}…`
  let summary = String(input.summary ?? '').trim()
  if (summary.length > MAX_SUMMARY_CHARS) summary = `${summary.slice(0, MAX_SUMMARY_CHARS)}…`
  const conf = ['low', 'medium', 'high'].includes(input.confidence) ? input.confidence : 'medium'
  const ttl = Number.isFinite(input.ttl_ms) ? Math.max(1_000, input.ttl_ms) : DEFAULT_TTL_MS
  const grace_ms = Number.isFinite(input.grace_ms)
    ? Math.max(0, input.grace_ms)
    : DEFAULT_GRACE_MS
  const advice = Array.isArray(input.advice)
    ? input.advice
        .filter((a) => a && typeof a.text === 'string' && a.text.trim())
        .map((a) => ({
          audience: ['human', 'workers', 'all'].includes(a.audience) ? a.audience : 'all',
          text: String(a.text).slice(0, 1_000),
        }))
        .slice(0, 20)
    : []
  const hotspots = Array.isArray(input.hotspots)
    ? input.hotspots.slice(0, 30).map((h) => ({
        repo_id: h?.repo_id ?? null,
        paths: Array.isArray(h?.paths) ? h.paths.map(String).slice(0, 20) : [],
        sessions: Array.isArray(h?.sessions) ? h.sessions.map(String).slice(0, 20) : [],
        note: h?.note != null ? String(h.note).slice(0, 400) : '',
      }))
    : []
  return {
    schema: 1,
    kind: 'sage.brief',
    scope,
    repo_id: scope === 'repo' ? input.repo_id ?? null : null,
    judge_sid: String(input.judge_sid || ''),
    judge_repo_id: input.judge_repo_id != null ? String(input.judge_repo_id) : null,
    judge_pid: Number.isFinite(input.judge_pid) ? input.judge_pid : null,
    updated_at: input.updated_at || new Date(now).toISOString(),
    status: input.status === 'stale' ? 'stale' : 'active',
    ttl_ms: ttl,
    grace_ms,
    inputs:
      input.inputs && typeof input.inputs === 'object'
        ? {
            live: Number(input.inputs.live) || 0,
            contested: Number(input.inputs.contested) || 0,
            sources: Array.isArray(input.inputs.sources)
              ? input.inputs.sources.map(String).slice(0, 10)
              : [],
          }
        : { live: 0, contested: 0, sources: [] },
    summary,
    analysis,
    hotspots,
    advice,
    confidence: conf,
  }
}

export const markBriefStale = (home, scope, repoId) => {
  const file = briefPathFor(home, scope, repoId)
  const cur = readBriefFile(file)
  if (!cur) return false
  writeBriefFile(file, { ...cur, status: 'stale', updated_at: new Date().toISOString() })
  return true
}

/** True if the brief's judge session still holds role=judge and is process-alive. */
export const isJudgeSessionLive = (home, brief, { now = Date.now() } = {}) => {
  if (!brief?.judge_sid || !brief?.judge_repo_id) return false
  const rec = readRecord(home, brief.judge_repo_id, brief.judge_sid)
  if (!rec || rec.role !== 'judge') return false
  if (rec.status === 'closed' || rec.link_state === 'closed') return false
  // Prefer derived alive; fall back to pid probe if record lacks live flags.
  if (rec.alive === false) return false
  if (rec.pid) {
    try {
      if (!isAlive(rec.pid, { startTime: rec.pid_start })) return false
    } catch {
      return false
    }
  }
  // Without pid we cannot prove live — treat as not live for attach safety.
  if (!rec.pid) return false
  void now
  return true
}

/**
 * Fresh for worker attach when:
 *  1. status active and age ≤ ttl_ms, AND
 *  2a. judge session is still live with role=judge, OR
 *  2b. age ≤ grace_ms (post-exit burst window — dogfood / crash tolerance).
 *
 * Slot exclusivity must NOT use grace alone — see `slotHolder`.
 */
export const isBriefFresh = (
  brief,
  { now = Date.now(), home, graceMs = DEFAULT_GRACE_MS } = {},
) => {
  if (!brief || brief.status !== 'active') return false
  const ttl = Number.isFinite(brief.ttl_ms) ? brief.ttl_ms : DEFAULT_TTL_MS
  const grace = Number.isFinite(brief.grace_ms)
    ? Math.max(0, brief.grace_ms)
    : Number.isFinite(graceMs)
      ? Math.max(0, graceMs)
      : DEFAULT_GRACE_MS
  const t = Date.parse(brief.updated_at)
  if (!Number.isFinite(t)) return false
  const age = now - t
  if (age > ttl) return false
  // Time-only path (no home): used by pure unit tests / preview.
  if (home == null) return true
  if (isJudgeSessionLive(home, brief, { now })) return true
  // Dead / gone judge: keep narrative for a short grace after last publish.
  return age <= grace
}

/** True when attach would use the post-exit grace path (dead judge, still young). */
export const isBriefInGrace = (brief, { now = Date.now(), home, graceMs = DEFAULT_GRACE_MS } = {}) => {
  if (!brief || home == null) return false
  if (!isBriefFresh(brief, { now, home, graceMs })) return false
  return !isJudgeSessionLive(home, brief, { now })
}

/**
 * Load attachable briefs for a worker in repoId.
 * Returns { repo: brief|null, fleet: brief|null } — only fresh ones.
 */
export const loadAttachableBriefs = (home, repoId, { now = Date.now(), noBrief = false } = {}) => {
  if (noBrief) return { repo: null, fleet: null }
  let repo = null
  if (repoId) {
    const b = readBriefFile(repoBriefFile(home, repoId))
    if (b && isBriefFresh(b, { now, home })) repo = b
  }
  let fleet = null
  const fb = readBriefFile(fleetBriefFile(home))
  if (fb && isBriefFresh(fb, { now, home })) fleet = fb
  return { repo, fleet }
}

const ageLabel = (brief, now) => {
  const t = Date.parse(brief.updated_at)
  if (!Number.isFinite(t)) return '?'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

const formatOne = (brief, { now = Date.now(), grace = false } = {}) => {
  const scope = brief.scope === 'fleet' ? 'fleet' : 'repo'
  const conf = brief.confidence || 'medium'
  const graceChip = grace ? ' · grace' : ''
  const head = `── live judge · ${scope} · ${ageLabel(brief, now)} · ${conf}${graceChip} ──`
  const lines = [head]
  if (brief.summary) lines.push(`  ${brief.summary}`)
  if (brief.analysis) {
    for (const para of String(brief.analysis).split(/\n+/)) {
      const p = para.trim()
      if (p) lines.push(`  ${p}`)
    }
  }
  const advice = (brief.advice || []).filter(
    (a) => a.audience === 'all' || a.audience === 'workers' || a.audience === 'human',
  )
  for (const a of advice) {
    lines.push(`  → ${a.text}`)
  }
  return lines.join('\n')
}

/** Layered render: repo then fleet (design order). */
export const renderBriefLayers = (briefs, { now = Date.now(), home } = {}) => {
  const parts = []
  if (briefs?.repo) {
    parts.push(
      formatOne(briefs.repo, {
        now,
        grace: home != null && isBriefInGrace(briefs.repo, { now, home }),
      }),
    )
  }
  if (briefs?.fleet) {
    parts.push(
      formatOne(briefs.fleet, {
        now,
        grace: home != null && isBriefInGrace(briefs.fleet, { now, home }),
      }),
    )
  }
  return parts.join('\n\n')
}

export const attachBriefText = (factText, briefs, { now = Date.now(), home } = {}) => {
  const layer = renderBriefLayers(briefs, { now, home })
  if (!layer) return factText
  return `${factText}\n\n${layer}`
}

/**
 * Slot occupancy for `judge on`: only a **live** judge holds the slot.
 * Grace-window briefs from a dead process do not block a new judge.
 */
export const slotHolder = (home, scope, repoId, { now = Date.now() } = {}) => {
  const file = briefPathFor(home, scope, repoId)
  const b = readBriefFile(file)
  if (!b || b.status !== 'active') return null
  if (!isJudgeSessionLive(home, b, { now })) return null
  return b
}

export const countLiveJudges = (sessions = []) =>
  sessions.filter((s) => isJudge(s) && LIVE.has(s.liveness)).length
