// Control + diagnostics for the `sage` CLI. Writes only SAGE's own state
// (global config, session link_state) — never the repo or settings.json.
import fs from 'node:fs'
import path from 'node:path'
import { sageHome, globalConfig, sessionsDir } from './paths.mjs'
import { readJson, atomicWriteJson, mergeRecord } from './store.mjs'
import { resolveRepoId, resolveRepoRoot } from './repo-id.mjs'
import { adapterPathFor } from './adapter.mjs'
import { explainRepoDataDir, readRegistry, legacySageHome } from './roots.mjs'
import { getHarness } from './harness.mjs'

export const readEnabled = (home) => {
  const g = readJson(globalConfig(home))
  return !!(g && g.enabled === true)
}

export const setEnabled = (home, on) => {
  // mkdir only the resolved config's parent. On a legacy-only install
  // globalConfigPath still points under ~/.claude/sage — creating
  // ~/.claude/agentic-sage/ here would poison migrateStateDir (both-warn, no rename).
  const cfg = globalConfig(home)
  fs.mkdirSync(path.dirname(cfg), { recursive: true })
  // Merge: never drop other global keys (e.g. tokenForecastPath) when toggling.
  const cur = readJson(cfg) || {}
  atomicWriteJson(cfg, { ...cur, enabled: !!on })
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

  // Scan both homes: new agentic-sage first (preferred), then legacy sage for
  // npm-update-no-re-init installs that still store sessions under rule-5.
  const scanRoots = [path.join(sageHome(home), 'repos')]
  const legacyRepos = path.join(legacySageHome(home), 'repos')
  if (legacyRepos !== scanRoots[0]) scanRoots.push(legacyRepos)

  for (const reposRoot of scanRoots) {
    let dirs = []
    try {
      dirs = fs.readdirSync(reposRoot)
    } catch {
      /* no repos/ dir yet */
    }
    for (const repoId of dirs) {
      if (out.has(repoId)) continue // new home wins when both exist
      let sessions = 0
      try {
        // Prefer path resolution (new or rule-5 legacy) when counting sessions
        // for ids also reachable via sessionsDir; fall back to the scan dir.
        sessions = fs
          .readdirSync(sessionsDir(home, repoId))
          .filter((f) => f.endsWith('.json')).length
      } catch {
        try {
          sessions = fs
            .readdirSync(path.join(reposRoot, repoId, 'sessions'))
            .filter((f) => f.endsWith('.json')).length
        } catch {
          /* no sessions dir */
        }
      }
      out.set(repoId, { repoId, sessions })
    }
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
  const homeOk = newHomeOk || legacyHomeOk
  checks.push({
    name: 'sage home',
    ok: homeOk,
    detail: newHomeOk
      ? newHome
      : legacyHomeOk
        ? `${legacyHome} (legacy — run \`sage init --repair\` to migrate)`
        : newHome,
    ...(homeOk ? {} : { fix: 'sage init' }),
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
  // Checks .claude (works for Claude + Grok via [compat.claude] default).
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
    detail: `${wired} hook(s) reference sage-emit (Claude + Grok compat)`,
    ...(settingsOk ? {} : { fix: 'sage init --repair' }),
  })

  // skill symlinks — install.mjs links every skills/* into ~/.claude/skills.
  // Grok discovers them via compat (and also ~/.grok/skills). sage-fleet makes
  // sessions coordinate; sage-doctor is the /sage-doctor front door.
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

  // grok native wiring (plan 014): only surface when ~/.grok dir exists.
  // ok if agentic-sage.json (or legacy sage.json) present with resolvable emitter.
  // uses fix (not remedy) to match sibling checks + renderDoctor.
  const grokHome = path.join(home, '.grok')
  if (fs.existsSync(grokHome)) {
    const gProfile = getHarness('grok')
    const hookDir = gProfile ? gProfile.hooksDir(home) : path.join(grokHome, 'hooks')
    const hookFile = path.join(hookDir, 'agentic-sage.json')
    const legacyGrok = path.join(hookDir, 'sage.json')
    let ok = false
    let detail = 'not wired'
    try {
      let cfg = null
      let used = null
      if (fs.existsSync(hookFile)) {
        cfg = JSON.parse(fs.readFileSync(hookFile, 'utf8'))
        used = hookFile
      } else if (fs.existsSync(legacyGrok)) {
        cfg = JSON.parse(fs.readFileSync(legacyGrok, 'utf8'))
        used = legacyGrok
        detail = 'legacy sage.json present'
      }
      if (cfg?.hooks) {
        const cmd = cfg.hooks.SessionStart?.[0]?.hooks?.[0]?.command || ''
        const ref = cmd.replace(/^node\s+/, '')
        ok = Boolean(ref) && fs.existsSync(ref)
        detail = ok
          ? used || hookFile
          : `emitter missing at ${ref || '(none)'}${used ? ` (${path.basename(used)})` : ''}`
      }
    } catch {
      detail = 'invalid or unreadable hook file'
    }
    const row = { name: 'grok wiring', ok, detail }
    if (!ok) row.fix = 'sage init --global --harness both'
    checks.push(row)
  }

  // token-forecast is an optional external integration — config-driven, no
  // hardcoded personal path. Set `tokenForecastPath` in the global config to
  // surface it; absent ⇒ the check stays green and just says so.
  const tfRaw = g && typeof g.tokenForecastPath === 'string' ? g.tokenForecastPath : null
  if (!tfRaw) {
    checks.push({ name: 'token-forecast', ok: true, detail: 'not configured (optional)' })
  } else {
    const tf = tfRaw.startsWith('~') ? path.join(home, tfRaw.slice(1)) : tfRaw
    const tfOk = exists(tf)
    checks.push({
      name: 'token-forecast',
      ok: tfOk,
      detail: tfOk ? 'present' : `absent (${tfRaw})`,
      ...(tfOk ? {} : { fix: 'create the path or unset tokenForecastPath in config' }),
    })
  }

  const repoId = resolveRepoId(cwd)
  const repoOk = !!repoId
  checks.push({
    name: 'current repo',
    ok: repoOk,
    detail: repoId || 'not a git repo',
    ...(repoOk ? {} : { fix: 'cd into a git repo SAGE judges' }),
  })

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

// Compact block gauge for health banner (plain text; color via paint()).
const healthGauge = (pct, width = 10) => {
  const w = Math.max(1, width | 0)
  const p = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
  if (p <= 0) return '░'.repeat(w)
  if (p >= 100) return '█'.repeat(w)
  const n = Math.round((p / 100) * w)
  return '█'.repeat(n) + '░'.repeat(w - n)
}

// Health banner + checklist. Failures always carry a `→ run: <fix>` hint line.
// Exit codes are the caller's concern (bin/sage keeps doctor exit 0).
export const renderDoctor = (checks) => {
  const n = checks.length
  const okN = checks.filter((c) => c.ok).length
  const bad = n - okN
  const pct = n ? Math.round((okN / n) * 100) : 100
  const gauge = healthGauge(pct)
  const head = `SAGE doctor · HEALTH ${okN}/${n} ${gauge} ${pct}%`
  const verdict = `  ${okN} ok · ${bad} need attention`
  const lines = [head]
  for (const c of checks) {
    lines.push(`  ${c.ok ? '✓' : '✗'} ${c.name} — ${c.detail}`)
    if (!c.ok && c.fix) lines.push(`      → run: ${c.fix}`)
  }
  lines.push(verdict)
  return lines.join('\n')
}
