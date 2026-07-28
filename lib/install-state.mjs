// Install/wire state for package freshness (machine-global under sage home).
// Mirrors memory-atlas .atlas-state wiredVersion idea without per-repo pins.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sageHome } from './paths.mjs'
import { readJson, atomicWriteJson } from './store.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.resolve(__dirname, '..')

export const statePath = (home) => path.join(sageHome(home), 'state.json')

/** Running package version from this install tree. */
export const packageVersion = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'))
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export const readInstallState = (home) => {
  const s = readJson(statePath(home))
  return s && typeof s === 'object' && !Array.isArray(s) ? s : null
}

/**
 * Merge-write install state. Never throws (callers fail-open).
 * @param {string} home
 * @param {Record<string, unknown>} patch
 */
export const writeInstallState = (home, patch) => {
  try {
    const file = statePath(home)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const cur = readInstallState(home) || {}
    const next = { ...cur, ...patch }
    if (patch.updateCheck && typeof patch.updateCheck === 'object') {
      next.updateCheck = {
        ...(typeof cur.updateCheck === 'object' && cur.updateCheck ? cur.updateCheck : {}),
        ...patch.updateCheck,
      }
    }
    atomicWriteJson(file, next)
    return next
  } catch {
    return null
  }
}

/** Stamp wiredVersion after successful wire/init. */
export const stampWired = (home, version = packageVersion()) =>
  writeInstallState(home, {
    wiredVersion: String(version),
    wiredAt: new Date().toISOString(),
  })
