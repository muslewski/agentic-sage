// The three-tier enable gate. DEFAULT-OFF: a fresh machine with no global
// config is disabled. This is the emitter's first real work — a disabled
// session exits before any git or fs write.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { globalConfig, repoConfig } from './paths.mjs'

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

// Tier 1 only — the cheapest possible check (one small file read, no git).
// The emitter calls this BEFORE resolving the repo id so a disabled machine
// spawns zero git processes per hook.
export const isGloballyEnabled = (home = os.homedir()) => {
  const g = readJson(globalConfig(home))
  return !!(g && g.enabled === true)
}

// scope: 'global' (default) is today's three-tier gate. scope: 'project' is a
// project-scoped install (the hook wired in <repo>/.claude/settings.json) —
// running init on a project implies opt-in, so it ignores the global master
// entirely. Opt-out (tier 3) always wins, in both scopes.
export const isEnabled = ({
  home = os.homedir(),
  repoId,
  cwd,
  env = process.env,
  scope = 'global',
} = {}) => {
  // Tier 3 — per-session opt-out. Hoisted first so it applies identically to
  // both scopes regardless of which branch below returns.
  if (env && env.SAGE_OPT_OUT === '1') return false
  if (cwd) {
    try {
      if (fs.existsSync(path.join(cwd, '.sage-ignore'))) return false
    } catch {
      /* ignore */
    }
  }

  if (scope === 'project') {
    // Project scope skips the global master — a project install must work
    // even with it OFF. Still honors an explicit per-repo {enabled:false}.
    if (repoId) {
      const r = readJson(repoConfig(home, repoId))
      if (r && r.enabled === false) return false
    }
    return true
  }

  // Tier 1 — global. Missing or not exactly {enabled:true} ⇒ OFF (the default).
  if (!isGloballyEnabled(home)) return false

  // Tier 2 — per-repo. Enabled unless this repo is explicitly {enabled:false}.
  if (repoId) {
    const r = readJson(repoConfig(home, repoId))
    if (r && r.enabled === false) return false
  }

  return true
}
