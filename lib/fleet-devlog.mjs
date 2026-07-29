// fleet-devlog reference emitter — zero deps, fail-open, allow-list only.
// Vendored byte-identical into memory-atlas, agentic-sage, llm-armory.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const TOOLS = new Set(['memory-atlas', 'agentic-sage', 'llm-armory', 'mossferry'])
const RESULT = new Set(['ok', 'failed', 'timeout', 'auth', 'ratelimit', 'killed', 'missing_output'])
const OFF = new Set(['0', 'false', 'off', 'no'])
const ON = new Set(['1', 'true', 'on', 'yes'])
const MAX = 8 * 1024 * 1024
const DEF_REF = '/home/kento/Repositories/work-kb/contracts/fleet-devlog.reference.mjs'

export function referencePath(env = process.env) {
  return env.FLEET_DEVLOG_REF || DEF_REF
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

export function installId({ root }) {
  try {
    const p = path.join(root, 'install-id')
    if (fs.existsSync(p)) {
      const id = fs.readFileSync(p, 'utf8').trim()
      if (/^[0-9a-f]{16,}$/i.test(id)) return id.toLowerCase()
    }
    if (!ensureDir(root)) return 'unknown'
    const id = crypto.randomBytes(16).toString('hex')
    try {
      fs.writeFileSync(p, id, { flag: 'wx' })
      return id
    } catch {
      const again = fs.readFileSync(p, 'utf8').trim()
      if (/^[0-9a-f]{16,}$/i.test(again)) return again.toLowerCase()
      return 'unknown'
    }
  } catch {
    return 'unknown'
  }
}

export function sanitizeEvent(evt, { safeFlags = [] } = {}) {
  if (!evt || !TOOLS.has(evt.tool)) return null
  const out = { v: 1, tool: evt.tool }
  if (typeof evt.ts === 'string') out.ts = evt.ts
  if (typeof evt.install_id === 'string') out.install_id = evt.install_id
  if (typeof evt.tool_version === 'string') out.tool_version = evt.tool_version
  if (typeof evt.cmd === 'string') out.cmd = evt.cmd
  if (typeof evt.exit === 'number' && Number.isFinite(evt.exit)) out.exit = evt.exit
  if (typeof evt.ms === 'number' && Number.isFinite(evt.ms)) out.ms = evt.ms
  if (typeof evt.repo_id === 'string') out.repo_id = evt.repo_id
  if (typeof evt.corr === 'string') out.corr = evt.corr
  if (RESULT.has(evt.result_class)) out.result_class = evt.result_class
  if (Array.isArray(evt.argv_shape)) {
    const allow = new Set(safeFlags)
    out.argv_shape = evt.argv_shape.filter((f) => typeof f === 'string' && allow.has(f))
  }
  if (evt.counts && typeof evt.counts === 'object' && !Array.isArray(evt.counts)) {
    const c = {}
    for (const [k, val] of Object.entries(evt.counts)) {
      if (typeof val === 'number' && Number.isFinite(val)) c[k] = val
    }
    out.counts = c
  }
  return out
}

export function emit(evt, { root, env = {}, argv = [], config = null, safeFlags = [] } = {}) {
  try {
    if (!devlogEnabled({ env, argv, config })) return
    if (!root) return
    const clean = sanitizeEvent(evt, { safeFlags })
    if (!clean) return
    clean.install_id = installId({ root })
    clean.ts = clean.ts || new Date().toISOString()
    if (!ensureDir(root)) return
    const file = path.join(root, 'events.jsonl')
    try {
      const st = fs.statSync(file)
      if (st.size > MAX) fs.renameSync(file, path.join(root, 'events.jsonl.1'))
    } catch { /* no file yet */ }
    fs.appendFileSync(file, JSON.stringify(clean) + '\n')
  } catch { /* fail-open: never throw */ }
}
