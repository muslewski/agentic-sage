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
  atomicWriteJson(globalConfig(home), { enabled: !!on })
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

  const tf = path.join(home, '.local', 'share', 'token-forecast')
  checks.push({ name: 'token-forecast', ok: true, detail: exists(tf) ? 'present' : 'absent (optional)' })

  const repoId = resolveRepoId(cwd)
  checks.push({ name: 'current repo', ok: !!repoId, detail: repoId || 'not a git repo' })

  return checks
}

export const renderDoctor = (checks) =>
  ['SAGE doctor', ...checks.map((c) => `  ${c.ok ? '✓' : '✗'} ${c.name} — ${c.detail}`)].join('\n')
