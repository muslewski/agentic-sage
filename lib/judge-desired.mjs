// judge.desired preference + soft offline probe (fleet-follow).
// Product default optional; preferred → soft warn only when unsatisfied.
// No import from control.mjs (doctor imports us — avoid cycles).
import fs from 'node:fs'
import path from 'node:path'
import { readJson } from './store.mjs'
import { globalConfig, sageHome, fleetBriefFile, sessionsDir } from './paths.mjs'
import {
  isJudge,
  loadAttachableBriefs,
  readBriefFile,
  isBriefFresh,
} from './brief.mjs'
import { collectSessions } from './board.mjs'
import { readRegistry, legacySageHome } from './roots.mjs'

/**
 * @param {Record<string, unknown> | null | undefined} g global config
 * @returns {{ desired: 'optional' | 'preferred', warnIfOffline: boolean, scope: string, harness: string }}
 */
export const readJudgeDesired = (g) => {
  const j = g && typeof g.judge === 'object' && g.judge ? g.judge : {}
  const desired = j.desired === 'preferred' ? 'preferred' : 'optional'
  const warnIfOffline = j.warnIfOffline === false ? false : true
  return {
    desired,
    warnIfOffline,
    scope: typeof j.scope === 'string' ? j.scope : 'auto',
    harness: typeof j.harness === 'string' ? j.harness : 'auto',
  }
}

export const readJudgeDesiredFromHome = (home) =>
  readJudgeDesired(readJson(globalConfig(home)))

/** Collect repo ids from built-in + legacy + registry (lightweight). */
const listRepoIds = (home) => {
  const ids = new Set()
  const scan = (reposRoot) => {
    try {
      for (const name of fs.readdirSync(reposRoot)) {
        if (name.startsWith('.')) continue
        try {
          if (fs.statSync(path.join(reposRoot, name)).isDirectory()) ids.add(name)
        } catch {
          /* skip */
        }
      }
    } catch {
      /* missing */
    }
  }
  scan(path.join(sageHome(home), 'repos'))
  scan(path.join(legacySageHome(home), 'repos'))
  try {
    const reg = readRegistry(home)
    for (const id of Object.keys(reg.repos || {})) ids.add(id)
  } catch {
    /* skip */
  }
  return [...ids]
}

/**
 * True when a live role=judge session exists anywhere under sage home.
 * @param {string} home
 * @param {{ now?: number }} [opts]
 */
export const hasLiveJudgeSession = (home, { now = Date.now() } = {}) => {
  try {
    for (const repoId of listRepoIds(home)) {
      // Skip empty session dirs quickly
      try {
        const dir = sessionsDir(home, repoId)
        if (!fs.existsSync(dir)) continue
      } catch {
        continue
      }
      const sessions = collectSessions(home, repoId, now)
      for (const s of sessions) {
        if (!isJudge(s)) continue
        if (s.status === 'closed' || s.link_state === 'closed') continue
        if (s.alive === false) continue
        if (s.liveness === 'dead' || s.liveness === 'closed') continue
        if (
          s.alive === true ||
          s.liveness === 'working' ||
          s.liveness === 'idle' ||
          s.liveness === 'stalled'
        ) {
          return true
        }
      }
    }
  } catch {
    /* fail-open unsatisfied */
  }
  return false
}

/**
 * Preferred desire is satisfied by live judge OR any attachable brief
 * (fleet, or repo brief when repoId provided).
 *
 * @param {string} home
 * @param {{ now?: number, repoId?: string | null }} [opts]
 * @returns {boolean}
 */
export const isJudgeDesireSatisfied = (home, { now = Date.now(), repoId = null } = {}) => {
  if (hasLiveJudgeSession(home, { now })) return true
  try {
    const fleet = readBriefFile(fleetBriefFile(home))
    if (fleet && isBriefFresh(fleet, { now, home })) return true
  } catch {
    /* continue */
  }
  if (repoId) {
    const { repo, fleet } = loadAttachableBriefs(home, repoId, { now })
    if (repo || fleet) return true
  }
  return false
}

/**
 * @param {string} home
 * @param {{ now?: number, repoId?: string | null }} [opts]
 * @returns {{ desired: string, warnIfOffline: boolean, satisfied: boolean, shouldWarn: boolean }}
 */
export const evaluateJudgeDesire = (home, opts = {}) => {
  const pref = readJudgeDesiredFromHome(home)
  const satisfied = isJudgeDesireSatisfied(home, opts)
  const shouldWarn =
    pref.desired === 'preferred' && pref.warnIfOffline !== false && !satisfied
  return { ...pref, satisfied, shouldWarn }
}

/** SessionStart / gate one-liner (no trailing newline). */
export const preferredOfflineLine = () =>
  'live judge preferred · offline — run: sage judge run'

/** Doctor detail string for live-judge row. */
export const doctorLiveJudgeDetail = (home, opts = {}) => {
  const ev = evaluateJudgeDesire(home, opts)
  if (ev.desired === 'optional') {
    return 'optional — sage judge run starts a live mind; CLI facts work without it'
  }
  if (ev.satisfied) {
    return 'preferred · satisfied (live judge or fresh brief)'
  }
  return 'preferred · offline — run: sage judge run'
}
