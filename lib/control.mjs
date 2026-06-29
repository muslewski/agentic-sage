// Control + diagnostics for the `sage` CLI. Writes only SAGE's own state
// (global config, session link_state) — never the repo or settings.json.
import fs from 'node:fs'
import path from 'node:path'
import { sageHome, globalConfig, sessionsDir } from './paths.mjs'
import { readJson, atomicWriteJson, mergeRecord } from './store.mjs'
import { resolveRepoId } from './repo-id.mjs'

export const readEnabled = (home) => {
  const g = readJson(globalConfig(home))
  return !!(g && g.enabled === true)
}

export const setEnabled = (home, on) => {
  fs.mkdirSync(sageHome(home), { recursive: true })
  // Merge: never drop other global keys (e.g. tokenForecastPath) when toggling.
  const cur = readJson(globalConfig(home)) || {}
  atomicWriteJson(globalConfig(home), { ...cur, enabled: !!on })
  return !!on
}

export const linkSession = (home, repoId, sid, state = 'linked') =>
  mergeRecord(home, repoId, sid, { link_state: state, updated_at: new Date().toISOString() })

export const unlinkSession = (home, repoId, sid) => linkSession(home, repoId, sid, 'closed')

export const listRepos = (home) => {
  let dirs = []
  try {
    dirs = fs.readdirSync(path.join(sageHome(home), 'repos'))
  } catch {
    return []
  }
  return dirs.map((repoId) => {
    let sessions = 0
    try {
      sessions = fs.readdirSync(sessionsDir(home, repoId)).filter((f) => f.endsWith('.json')).length
    } catch {
      /* no sessions dir */
    }
    return { repoId, sessions }
  })
}

const exists = (p) => {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

export const doctor = (home, cwd) => {
  const checks = []
  checks.push({ name: 'sage home', ok: exists(sageHome(home)), detail: sageHome(home) })

  const g = readJson(globalConfig(home))
  checks.push({
    name: 'global config',
    ok: !!g,
    detail: g ? (g.enabled ? 'enabled' : 'disabled') : 'missing (default OFF)',
  })

  const hook = path.join(home, '.claude', 'hooks', 'sage-emit.mjs')
  let hookOk = false
  try {
    hookOk = fs.lstatSync(hook).isSymbolicLink()
  } catch {
    /* absent */
  }
  checks.push({
    name: 'emitter hook',
    ok: hookOk,
    detail: hookOk ? hook : 'not installed (run install.mjs)',
  })

  const settingsPath = path.join(home, '.claude', 'settings.json')
  const settings = readJson(settingsPath)
  let wired = 0
  if (settings && settings.hooks) {
    for (const ev of Object.keys(settings.hooks)) {
      for (const grp of settings.hooks[ev] || []) {
        for (const h of grp.hooks || []) {
          if (typeof h.command === 'string' && h.command.includes('sage-emit')) wired++
        }
      }
    }
  }
  checks.push({ name: 'settings wiring', ok: wired > 0, detail: `${wired} hook(s) reference sage-emit` })

  // skill symlinks — install.mjs links every skills/* into ~/.claude/skills.
  // sage-fleet makes sessions coordinate; sage-doctor is the /sage-doctor front door.
  const skillsDir = path.join(home, '.claude', 'skills')
  const isLink = (name) => {
    try {
      return fs.lstatSync(path.join(skillsDir, name)).isSymbolicLink()
    } catch {
      return false
    }
  }
  const want = ['sage-fleet', 'sage-doctor']
  const missing = want.filter((n) => !isLink(n))
  checks.push({
    name: 'skills linked',
    ok: missing.length === 0,
    detail: missing.length ? `missing: ${missing.join(', ')} (run install.mjs)` : want.join(', '),
  })

  // token-forecast is an optional external integration — config-driven, no
  // hardcoded personal path. Set `tokenForecastPath` in the global config to
  // surface it; absent ⇒ the check stays green and just says so.
  const tfRaw = g && typeof g.tokenForecastPath === 'string' ? g.tokenForecastPath : null
  if (!tfRaw) {
    checks.push({ name: 'token-forecast', ok: true, detail: 'not configured (optional)' })
  } else {
    const tf = tfRaw.startsWith('~') ? path.join(home, tfRaw.slice(1)) : tfRaw
    checks.push({ name: 'token-forecast', ok: exists(tf), detail: exists(tf) ? 'present' : `absent (${tfRaw})` })
  }

  const repoId = resolveRepoId(cwd)
  checks.push({ name: 'current repo', ok: !!repoId, detail: repoId || 'not a git repo' })

  return checks
}

export const renderDoctor = (checks) => {
  const bad = checks.filter((c) => !c.ok).length
  const verdict = `  ${checks.length - bad} ok · ${bad} need attention`
  return ['SAGE doctor', ...checks.map((c) => `  ${c.ok ? '✓' : '✗'} ${c.name} — ${c.detail}`), verdict].join('\n')
}
