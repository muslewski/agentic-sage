// Two-tier install freshness for agentic-sage (machine-global).
// Tier A: installed vs state.wiredVersion
// Tier B: installed vs npm latest (TTL cache, fail-open)
import { spawnSync } from 'node:child_process'
import { packageVersion, readInstallState, writeInstallState } from './install-state.mjs'
import { readJson } from './store.mjs'
import { globalConfig } from './paths.mjs'

// registry: false by default — everyday `sage gate` stays local (wired stamp only).
// Opt in via config packageFreshness.registry=true or `sage gate --check-latest`.
export const DEFAULT_PACKAGE_FRESHNESS = {
  mode: 'warn',
  registry: false,
  wired: true,
  registryTtlHours: 24,
}

/**
 * @param {Record<string, unknown> | null | undefined} g
 */
export function resolvePackageFreshness(g) {
  const raw = g?.packageFreshness
  const base = { ...DEFAULT_PACKAGE_FRESHNESS }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  if (raw.mode === 'fail' || raw.mode === 'warn') base.mode = raw.mode
  if (typeof raw.registry === 'boolean') base.registry = raw.registry
  if (typeof raw.wired === 'boolean') base.wired = raw.wired
  if (
    typeof raw.registryTtlHours === 'number' &&
    Number.isFinite(raw.registryTtlHours) &&
    raw.registryTtlHours >= 0
  ) {
    base.registryTtlHours = raw.registryTtlHours
  }
  return base
}

/** @param {string} a @param {string} b @returns {number} */
export function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0)
  const pb = String(b).replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}

export function evaluateWiredLag(state, installed) {
  const messages = []
  if (!state?.wiredVersion) {
    return { lag: false, wired: null, messages }
  }
  const wired = String(state.wiredVersion)
  const lag = wired !== installed
  if (lag) {
    messages.push(
      `⬆ agentic-sage ${installed} installed, wired ${wired} — run: sage init --repair`,
    )
  }
  return { lag, wired, messages }
}

export function evaluateRegistryLag(installed, latest) {
  const messages = []
  if (!latest) return { lag: false, latest: null, messages }
  if (compareVersions(installed, latest) >= 0) {
    return { lag: false, latest, messages }
  }
  messages.push(
    `⬆ agentic-sage ${latest} available on npm (installed ${installed}) — npm i -g agentic-sage@${latest} then sage init --repair`,
  )
  return { lag: true, latest, messages }
}

/** True when env asks us not to hit the network (CI, offline, explicit NO_*). */
export function registryProbeBlocked(env = process.env) {
  if (env.CI === 'true' || env.CI === '1') return true
  if (env.OFFLINE === '1' || env.OFFLINE === 'true') return true
  if (env.NO_NETWORK === '1' || env.NO_NETWORK === 'true') return true
  if (env.SAGE_NO_REGISTRY === '1' || env.SAGE_NO_REGISTRY === 'true') return true
  return false
}

export function fetchRegistryLatest(opts = {}) {
  const packageName = opts.packageName ?? 'agentic-sage'
  // Injected fetchLatest (tests): still honour CI/offline so opt-in probes stay
  // fail-open offline. Default gate never reaches here (registry false).
  if (registryProbeBlocked(opts.env ?? process.env)) return null
  if (typeof opts.fetchLatest === 'function') {
    try {
      return opts.fetchLatest(packageName)
    } catch {
      return null
    }
  }
  try {
    const result = spawnSync('npm', ['view', packageName, 'version'], {
      encoding: 'utf8',
      timeout: opts.timeoutMs ?? 2500,
    })
    if (result.status !== 0) return null
    const v = String(result.stdout || '').trim()
    return /^\d+\.\d+\.\d+/.test(v) ? v : null
  } catch {
    return null
  }
}

/**
 * @param {string} home
 * @param {{
 *   forceRegistry?: boolean,
 *   checkLatest?: boolean,
 *   fetchLatest?: (name: string) => string | null,
 *   now?: number,
 *   env?: NodeJS.ProcessEnv,
 * }} [opts]
 */
export function computePackageFreshness(home, opts = {}) {
  const g = readJson(globalConfig(home)) || {}
  const cfg = resolvePackageFreshness(g)
  const installed = packageVersion()
  const state = readInstallState(home)
  const messages = []
  let wiredLag = false
  let registryLag = false
  let latest = null

  if (cfg.wired) {
    const w = evaluateWiredLag(state, installed)
    wiredLag = w.lag
    messages.push(...w.messages)
  }

  // Network probe only when config opts in OR caller passes checkLatest/forceRegistry.
  const wantRegistry = cfg.registry || opts.checkLatest === true || opts.forceRegistry === true
  if (wantRegistry) {
    const ttlMs = (cfg.registryTtlHours || 24) * 3600_000
    const now = opts.now ?? Date.now()
    const cached = state?.updateCheck
    const cacheAge =
      cached?.checkedAt && Number.isFinite(Date.parse(cached.checkedAt))
        ? now - Date.parse(cached.checkedAt)
        : Infinity
    if (!opts.forceRegistry && cacheAge < ttlMs && cached?.latest) {
      latest = String(cached.latest)
    } else {
      latest = fetchRegistryLatest({
        fetchLatest: opts.fetchLatest,
        env: opts.env,
      })
      if (latest) {
        writeInstallState(home, {
          updateCheck: {
            checkedAt: new Date(now).toISOString(),
            latest,
            source: 'npm',
          },
        })
      } else if (cached?.latest) {
        latest = String(cached.latest)
      }
    }
    const r = evaluateRegistryLag(installed, latest)
    registryLag = r.lag
    messages.push(...r.messages)
  }

  const shouldFail = cfg.mode === 'fail' && (wiredLag || registryLag)
  return {
    installed,
    wired: state?.wiredVersion ? String(state.wiredVersion) : null,
    latest,
    wiredLag,
    registryLag,
    mode: cfg.mode,
    messages,
    shouldFail,
  }
}

/**
 * @param {{ shouldFail: boolean }} report
 * @param {boolean} strict
 */
export function shouldExitNonZero(report, strict) {
  if (strict) return !!(report.wiredLag || report.registryLag || report.shouldFail)
  return !!report.shouldFail
}

/**
 * Cheap SessionStart / inject soft line for Tier A (wired vs installed) only.
 * No registry network, never throws. Returns message body without sage: prefix, or null.
 *
 * @param {string} home
 * @param {{
 *   installed?: string,
 *   state?: { wiredVersion?: string } | null,
 *   globalConfig?: Record<string, unknown> | null,
 * }} [opts]
 * @returns {string | null}
 */
export function wiredLagSoftLine(home, opts = {}) {
  try {
    const g =
      opts.globalConfig !== undefined
        ? opts.globalConfig
        : readJson(globalConfig(home)) || {}
    const cfg = resolvePackageFreshness(g)
    if (!cfg.wired) return null
    const installed = opts.installed ?? packageVersion()
    const state = opts.state !== undefined ? opts.state : readInstallState(home)
    const w = evaluateWiredLag(state, installed)
    if (!w.lag || !w.messages.length) return null
    return w.messages[0]
  } catch {
    return null
  }
}
