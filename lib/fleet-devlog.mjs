// fleet-devlog reference emitter — zero deps, fail-open, allow-list only.
// Vendored byte-identical into memory-atlas, agentic-sage, llm-armory.
//
// Behavioural revision (schema field `v` still 1): sanitize drops invalid
// repo_id / counts keys / overlong strings; emit confines writes under root
// (realpath + O_NOFOLLOW); rotation renames that fail refuse further append.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const TOOLS = new Set(['memory-atlas', 'agentic-sage', 'llm-armory', 'mossferry'])
const RESULT = new Set(['ok', 'failed', 'timeout', 'auth', 'ratelimit', 'killed', 'missing_output'])
const OFF = new Set(['0', 'false', 'off', 'no'])
const ON = new Set(['1', 'true', 'on', 'yes'])
const MAX = 8 * 1024 * 1024
/** Max length for allow-listed free-form strings (cmd, tool_version, corr, ts, install_id input). */
const MAX_STR = 512
/** Documented shape: basename-8hex. No slashes; drop (do not coerce) anything else. */
const REPO_ID_RE = /^[A-Za-z0-9._-]+-[0-9a-f]{8}$/
/** counts keys: short snake tokens only — path-shaped keys are a privacy side-channel. */
const COUNTS_KEY_RE = /^[a-z][a-z0-9_]*$/
/** This module's own path — portable default for drift guards (never a desk absolute). */
const MODULE_REF = fileURLToPath(import.meta.url)

/**
 * Path of the reference source used by drift / checksum tests.
 * - If `FLEET_DEVLOG_REF` is set: that path (relative → resolved against cwd).
 * - Else: this module file (`import.meta.url`).
 * Does not check existence; use `readReference` when missing must fail closed.
 */
export function referencePath(env = process.env) {
  const override = env.FLEET_DEVLOG_REF
  if (override == null || override === '') return MODULE_REF
  return path.isAbsolute(override) ? override : path.resolve(override)
}

/**
 * Read the reference source for drift checks.
 * **Throws** if the path is missing or unreadable — never silently skip.
 * Drift guards must call this (or equivalent); a green suite that skipped is worse than no guard.
 */
export function readReference(env = process.env) {
  const p = referencePath(env)
  let source
  try {
    source = fs.readFileSync(p, 'utf8')
  } catch (err) {
    const why = err && err.message ? err.message : String(err)
    throw new Error(`fleet-devlog reference unresolvable at ${p}: ${why}`)
  }
  return { path: p, source }
}

/**
 * Pure `repo_id` join from an already-canonical main-root path string
 * (absolute, realpath, no trailing slash). Bash and JS must match for the same input.
 * See contracts/fleet-devlog-v1.md § repo_id algorithm steps 3–5.
 */
export function repoIdFromRoot(mainRoot) {
  if (typeof mainRoot !== 'string' || !mainRoot) return null
  const hex = crypto.createHash('sha256').update(mainRoot, 'utf8').digest('hex').slice(0, 8)
  return `${path.basename(mainRoot)}-${hex}`
}

export function devlogEnabled({ env = {}, argv = [], config = null } = {}) {
  const v = String(env.FLEET_DEVLOG ?? '').toLowerCase()
  if (OFF.has(v)) return false
  if (argv.includes('--no-devlog')) return false
  if (ON.has(v)) return true
  if (config && typeof config.enabled === 'boolean') return config.enabled
  return false
}

/** Create dir without recursive mkdir (hangs on some /proc paths). Fail-open. */
function ensureDir(dir) {
  try {
    if (fs.existsSync(dir)) return true
    const missing = []
    let cur = path.resolve(dir)
    while (!fs.existsSync(cur)) {
      missing.unshift(cur)
      const parent = path.dirname(cur)
      if (parent === cur) return false
      cur = parent
    }
    fs.accessSync(cur, fs.constants.W_OK)
    for (const p of missing) fs.mkdirSync(p)
    return true
  } catch {
    return false
  }
}

function clippedString(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= MAX_STR ? s : null
}

/**
 * Resolve candidate under rootReal. Returns resolved absolute path or null if
 * outside root, unresolvable, or a symlink chain that escapes.
 */
function resolveContained(rootReal, candidate) {
  try {
    let resolved
    if (fs.existsSync(candidate)) {
      resolved = fs.realpathSync(candidate)
    } else {
      const parent = path.dirname(candidate)
      if (!fs.existsSync(parent)) return null
      const parentReal = fs.realpathSync(parent)
      resolved = path.join(parentReal, path.basename(candidate))
    }
    const rel = path.relative(rootReal, resolved)
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null
    return resolved
  } catch {
    return null
  }
}

export function installId({ root }) {
  try {
    const p = path.join(root, 'install-id')
    if (fs.existsSync(p)) {
      const id = fs.readFileSync(p, 'utf8').trim()
      if (/^[0-9a-f]{16,}$/i.test(id) && id.length <= MAX_STR) return id.toLowerCase()
    }
    if (!ensureDir(root)) return 'unknown'
    const id = crypto.randomBytes(16).toString('hex')
    try {
      fs.writeFileSync(p, id, { flag: 'wx' })
      return id
    } catch {
      const again = fs.readFileSync(p, 'utf8').trim()
      if (/^[0-9a-f]{16,}$/i.test(again) && again.length <= MAX_STR) return again.toLowerCase()
      return 'unknown'
    }
  } catch {
    return 'unknown'
  }
}

export function sanitizeEvent(evt, { safeFlags = [] } = {}) {
  if (!evt || !TOOLS.has(evt.tool)) return null
  const out = { v: 1, tool: evt.tool }
  const ts = clippedString(evt.ts)
  if (ts) out.ts = ts
  const iid = clippedString(evt.install_id)
  if (iid) out.install_id = iid
  const tv = clippedString(evt.tool_version)
  if (tv) out.tool_version = tv
  const cmd = clippedString(evt.cmd)
  if (cmd) out.cmd = cmd
  if (typeof evt.exit === 'number' && Number.isFinite(evt.exit)) out.exit = evt.exit
  if (typeof evt.ms === 'number' && Number.isFinite(evt.ms)) out.ms = evt.ms
  // repo_id: documented shape only. Paths, empty string, and malformed values are
  // dropped (not coerced). Empty is omission per "outside a git repo" rule.
  if (typeof evt.repo_id === 'string' && REPO_ID_RE.test(evt.repo_id)) {
    out.repo_id = evt.repo_id
  }
  const corr = clippedString(evt.corr)
  if (corr) out.corr = corr
  if (RESULT.has(evt.result_class)) out.result_class = evt.result_class
  if (Array.isArray(evt.argv_shape)) {
    const allow = new Set(safeFlags)
    out.argv_shape = evt.argv_shape.filter((f) => typeof f === 'string' && allow.has(f))
  }
  if (evt.counts && typeof evt.counts === 'object' && !Array.isArray(evt.counts)) {
    const c = {}
    for (const [k, val] of Object.entries(evt.counts)) {
      if (typeof k === 'string' && COUNTS_KEY_RE.test(k) && typeof val === 'number' && Number.isFinite(val)) {
        c[k] = val
      }
    }
    out.counts = c
  }
  return out
}

/**
 * Append one JSONL line under root. Fail-open (never throws).
 * Refuses writes whose resolved target is outside the realpath of root
 * (symlink / escape). If rotation rename fails, does not grow past MAX.
 */
export function emit(evt, { root, env = {}, argv = [], config = null, safeFlags = [] } = {}) {
  try {
    if (!devlogEnabled({ env, argv, config })) return
    if (!root) return
    const clean = sanitizeEvent(evt, { safeFlags })
    if (!clean) return
    clean.install_id = installId({ root })
    clean.ts = clean.ts || new Date().toISOString()
    if (!ensureDir(root)) return

    let rootReal
    try {
      rootReal = fs.realpathSync(root)
    } catch {
      return
    }

    const file = path.join(root, 'events.jsonl')
    const fileResolved = resolveContained(rootReal, file)
    if (!fileResolved) return

    const rotated = path.join(root, 'events.jsonl.1')
    try {
      const st = fs.statSync(file)
      if (st.size > MAX) {
        const rotResolved = resolveContained(rootReal, rotated)
        if (!rotResolved) return
        try {
          fs.renameSync(file, rotated)
        } catch {
          // Cannot rotate (e.g. directory not writable) — refuse further growth.
          // Contract: hard 8MB bound; fail-open means log nothing, not grow forever.
          return
        }
      }
    } catch { /* no file yet */ }

    // Re-check after possible rename; create with O_NOFOLLOW when platform offers it.
    const again = resolveContained(rootReal, file)
    if (!again) return
    const line = JSON.stringify(clean) + '\n'
    const flags = fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT
    const nofollow = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0
    let fd
    try {
      fd = fs.openSync(file, flags | nofollow, 0o644)
    } catch {
      // Symlink (O_NOFOLLOW) or other open failure — fail-open.
      return
    }
    try {
      fs.writeSync(fd, line)
    } finally {
      try { fs.closeSync(fd) } catch { /* ignore */ }
    }
  } catch { /* fail-open: never throw */ }
}
