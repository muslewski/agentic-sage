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

export const isEnabled = ({ home = os.homedir(), repoId, cwd, env = process.env } = {}) => {
  // Tier 1 — global. Missing or not exactly {enabled:true} ⇒ OFF (the default).
  const g = readJson(globalConfig(home))
  if (!g || g.enabled !== true) return false

  // Tier 2 — per-repo. Enabled unless this repo is explicitly {enabled:false}.
  if (repoId) {
    const r = readJson(repoConfig(home, repoId))
    if (r && r.enabled === false) return false
  }

  // Tier 3 — per-session opt-out.
  if (env && env.SAGE_OPT_OUT === '1') return false
  if (cwd) {
    try {
      if (fs.existsSync(path.join(cwd, '.sage-ignore'))) return false
    } catch {
      /* ignore */
    }
  }

  return true
}
