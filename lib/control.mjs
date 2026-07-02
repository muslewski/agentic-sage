// Control + diagnostics for the `sage` CLI. Writes only SAGE's own state
// (global config, session link_state) — never the repo or settings.json.
import fs from 'node:fs'
import path from 'node:path'
import { sageHome, globalConfig, sessionsDir } from './paths.mjs'
import { readJson, atomicWriteJson, mergeRecord } from './store.mjs'
import { resolveRepoId, resolveRepoRoot } from './repo-id.mjs'
import { adapterPathFor } from './adapter.mjs'
import { explainRepoDataDir, readRegistry, legacySageHome } from './roots.mjs'

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

// Per-repo enable override — mirrors setEnabled but scoped to a resolved
// repo data dir's config.json rather than the global config. Distinct from
// the global on/off master (setEnabled above).
export const setRepoEnabled = (dataDir, on) => {
  fs.mkdirSync(dataDir, { recursive: true })
  const file = path.join(dataDir, 'config.json')
  const cur = readJson(file) || {}
  atomicWriteJson(file, { ...cur, enabled: !!on })
  return !!on
}

const countSessions = (dir) => {
  try {
    return fs.readdirSync(path.join(dir, 'sessions')).filter((f) => f.endsWith('.json')).length
  } catch {
    return 0
  }
}

// Union of the agent-home `repos/` scan (built-in/global storage) and the
// central registry's project-scoped / external-root entries (plans 007–009).
// Dedupe by repo id — a repo already found via the repos/ scan is not
// re-counted from the registry.
export const listRepos = (home) => {
  const out = new Map()

  let dirs = []
  try {
    dirs = fs.readdirSync(path.join(sageHome(home), 'repos'))
  } catch {
    /* no repos/ dir yet */
  }
  for (const repoId of dirs) {
    let sessions = 0
    try {
      sessions = fs.readdirSync(sessionsDir(home, repoId)).filter((f) => f.endsWith('.json')).length
    } catch {
      /* no sessions dir */
    }
    out.set(repoId, { repoId, sessions })
  }

  const registry = readRegistry(home)
  for (const [repoId, entry] of Object.entries(registry.repos || {})) {
    if (out.has(repoId)) continue
    out.set(repoId, { repoId, sessions: countSessions(entry.dataDir) })
  }

  return [...out.values()]
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
  // "sage home" — new dir wins; a legacy-only dir is still a healthy install
  // (read-only fallback works), just hinted so the user knows to migrate.
  const newHome = sageHome(home)
  const legacyHome = legacySageHome(home)
  const newHomeOk = exists(newHome)
  const legacyHomeOk = !newHomeOk && exists(legacyHome)
  checks.push({
    name: 'sage home',
    ok: newHomeOk || legacyHomeOk,
    detail: newHomeOk
      ? newHome
      : legacyHomeOk
        ? `${legacyHome} (legacy — run \`sage init --repair\` to migrate)`
        : newHome,
  })

  const g = readJson(globalConfig(home))
  const globalConfigOk = !!g
  checks.push({
    name: 'global config',
    ok: globalConfigOk,
    detail: g ? (g.enabled ? 'enabled' : 'disabled') : 'missing (default OFF)',
    ...(globalConfigOk ? {} : { fix: 'sage init' }),
  })

  // "emitter hook" — new name wins; falls back to the legacy (pre-rename)
  // name so an un-repaired old install still shows green, with a hint.
  const hookNew = path.join(home, '.claude', 'hooks', 'agentic-sage-emit.mjs')
  const hookLegacy = path.join(home, '.claude', 'hooks', 'sage-emit.mjs')
  let hookOk = false
  let hookDetail = 'not installed (run install.mjs)'
  try {
    if (fs.lstatSync(hookNew).isSymbolicLink()) {
      hookOk = true
      hookDetail = hookNew
    }
  } catch {
    /* absent */
  }
  if (!hookOk) {
    try {
      if (fs.lstatSync(hookLegacy).isSymbolicLink()) {
        hookOk = true
        hookDetail = `${hookLegacy} (legacy name — run \`sage init --repair\` to rename)`
      }
    } catch {
      /* absent */
    }
  }
  checks.push({
    name: 'emitter hook',
    ok: hookOk,
    detail: hookDetail,
    ...(hookOk ? {} : { fix: 'sage init --repair' }),
  })

  const settingsPath = path.join(home, '.claude', 'settings.json')
  const settings = readJson(settingsPath)
  let wired = 0
  if (settings?.hooks) {
    for (const ev of Object.keys(settings.hooks)) {
      for (const grp of settings.hooks[ev] || []) {
        for (const h of grp.hooks || []) {
          // Tolerant substring match — deliberately matches BOTH the new
          // (agentic-sage-emit.mjs) and legacy (sage-emit.mjs) hook names, so
          // this check stays green for an un-repaired old install too.
          if (typeof h.command === 'string' && h.command.includes('sage-emit')) wired++
        }
      }
    }
  }
  const settingsOk = wired > 0
  checks.push({
    name: 'settings wiring',
    ok: settingsOk,
    detail: `${wired} hook(s) reference sage-emit`,
    ...(settingsOk ? {} : { fix: 'sage init --repair' }),
  })

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
  const skillsOk = missing.length === 0
  checks.push({
    name: 'skills linked',
    ok: skillsOk,
    detail: skillsOk ? want.join(', ') : `missing: ${missing.join(', ')} (run install.mjs)`,
    ...(skillsOk ? {} : { fix: 'sage init --repair' }),
  })

  // token-forecast is an optional external integration — config-driven, no
  // hardcoded personal path. Set `tokenForecastPath` in the global config to
  // surface it; absent ⇒ the check stays green and just says so.
  const tfRaw = g && typeof g.tokenForecastPath === 'string' ? g.tokenForecastPath : null
  if (!tfRaw) {
    checks.push({ name: 'token-forecast', ok: true, detail: 'not configured (optional)' })
  } else {
    const tf = tfRaw.startsWith('~') ? path.join(home, tfRaw.slice(1)) : tfRaw
    checks.push({
      name: 'token-forecast',
      ok: exists(tf),
      detail: exists(tf) ? 'present' : `absent (${tfRaw})`,
    })
  }

  const repoId = resolveRepoId(cwd)
  checks.push({ name: 'current repo', ok: !!repoId, detail: repoId || 'not a git repo' })

  // storage dir + scope/precedence — only meaningful inside a judged repo;
  // "scope + storage" is always informational (ok: true), just explains
  // which rule (env|marker|registry|default-root|built-in) fired.
  if (repoId) {
    const mainRoot = resolveRepoRoot(cwd)
    const info = explainRepoDataDir({ home, mainRoot, repoId })
    const storageOk = exists(info.dir)
    checks.push({
      name: 'storage dir',
      ok: storageOk,
      detail: storageOk ? info.dir : `missing (${info.dir})`,
      ...(storageOk ? {} : { fix: 'sage init --repair' }),
    })
    checks.push({
      name: 'scope + storage',
      ok: true,
      detail: `${info.scope} · ${info.dir} · via ${info.rule}`,
    })
  } else {
    checks.push({ name: 'storage dir', ok: true, detail: 'n/a (not a git repo)' })
    checks.push({ name: 'scope + storage', ok: true, detail: 'n/a (not a git repo)' })
  }

  // project adapter — optional enrichment; "none" is healthy (core-only).
  const adapterPath = repoId ? adapterPathFor(home, repoId, resolveRepoRoot(cwd)) : null
  checks.push({
    name: 'project adapter',
    ok: true,
    detail: adapterPath ? `present (${adapterPath})` : 'none (core-only — fine)',
  })

  return checks
}

export const renderDoctor = (checks) => {
  const bad = checks.filter((c) => !c.ok).length
  const verdict = `  ${checks.length - bad} ok · ${bad} need attention`
  const lines = ['SAGE doctor']
  for (const c of checks) {
    lines.push(`  ${c.ok ? '✓' : '✗'} ${c.name} — ${c.detail}`)
    if (!c.ok && c.fix) lines.push(`      → run: ${c.fix}`)
  }
  lines.push(verdict)
  return lines.join('\n')
}
