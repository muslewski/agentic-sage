/**
 * Local-first debug telemetry for agentic-sage.
 * Default OFF. Fleet enables via ~/.config/agentic-sage/config.json or CLI.
 * Zero network. Fail-open always.
 */
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { packageVersion } from './install-state.mjs'

export const DEFAULT_TELEMETRY = {
  enabled: false,
  level: 'debug',
}

const GLOBAL_DIR = () => path.join(os.homedir(), '.config', 'agentic-sage')
const CACHE_DIR = () => path.join(os.homedir(), '.cache', 'agentic-sage')
const GLOBAL_CONFIG = () => path.join(GLOBAL_DIR(), 'config.json')
const EVENTS_FILE = () => path.join(CACHE_DIR(), 'events.jsonl')
const INSTALL_ID_FILE = () => path.join(CACHE_DIR(), 'install-id')

const SAFE_FLAGS = new Set([
  '--strict',
  '--force',
  '--json',
  '--watch',
  '--wide',
  '-w',
  '--all',
  '--once',
  '--takeover',
  '--print-only',
  '--fleet',
  '--repo',
  '--auto',
  '--harness',
  '--no-brief',
  '--no-telemetry',
  '--help',
  '-h',
  '--yes',
  'on',
  'off',
  'status',
  'report',
  'dump',
  'clear',
  'grok',
  'claude',
  'none',
  'auto',
  'list',
  'add',
  'rm',
])

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

export function loadMachineTelemetryConfig() {
  return readJsonFile(GLOBAL_CONFIG()) || {}
}

export function writeMachineTelemetryConfig(patch) {
  const dir = GLOBAL_DIR()
  fs.mkdirSync(dir, { recursive: true })
  const cur = loadMachineTelemetryConfig()
  const next = { ...cur, ...patch }
  if (patch.telemetry && typeof patch.telemetry === 'object') {
    next.telemetry = {
      ...(typeof cur.telemetry === 'object' && cur.telemetry ? cur.telemetry : {}),
      ...patch.telemetry,
    }
  }
  fs.writeFileSync(GLOBAL_CONFIG(), `${JSON.stringify(next, null, 2)}\n`)
}

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   argv?: string[],
 *   machineConfig?: Record<string, unknown> | null,
 * }} [opts]
 */
export function resolveTelemetryEnabled(opts = {}) {
  const env = opts.env ?? process.env
  const argv = opts.argv ?? process.argv
  const raw = env.SAGE_TELEMETRY
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  if (argv.includes('--no-telemetry')) return false
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true

  const machine =
    opts.machineConfig !== undefined ? opts.machineConfig : loadMachineTelemetryConfig()
  const gTel = machine?.telemetry
  if (gTel && typeof gTel === 'object' && typeof gTel.enabled === 'boolean') {
    return gTel.enabled
  }
  return false
}

export function getInstallId() {
  try {
    fs.mkdirSync(CACHE_DIR(), { recursive: true })
    const f = INSTALL_ID_FILE()
    if (fs.existsSync(f)) {
      const id = fs.readFileSync(f, 'utf8').trim()
      if (id) return id
    }
    const id = randomUUID().replace(/-/g, '')
    fs.writeFileSync(f, `${id}\n`)
    return id
  } catch {
    return 'unknown'
  }
}

export function hashRepoRoot(repoRoot) {
  if (!repoRoot) return null
  return createHash('sha256').update(path.resolve(repoRoot)).digest('hex').slice(0, 12)
}

export function argvShape(argv) {
  if (!Array.isArray(argv)) return []
  const out = []
  for (const a of argv) {
    if (typeof a !== 'string') continue
    if (SAFE_FLAGS.has(a)) out.push(a)
  }
  return out
}

export function emitEvent(event, opts = {}) {
  try {
    const file = opts.eventsPath ?? EVENTS_FILE()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.appendFileSync(file, `${JSON.stringify(event)}\n`, 'utf8')
  } catch {
    /* fail-open */
  }
}

/**
 * @param {{
 *   cmd: string,
 *   argv?: string[],
 *   exit: number,
 *   ms: number,
 *   repoRoot?: string | null,
 *   judgeDesired?: string | null,
 *   judgeSatisfied?: boolean | null,
 *   enabled?: boolean,
 *   env?: NodeJS.ProcessEnv,
 *   processArgv?: string[],
 * }} args
 */
export function trackCommand(args) {
  const enabled =
    typeof args.enabled === 'boolean'
      ? args.enabled
      : resolveTelemetryEnabled({ env: args.env, argv: args.processArgv })
  if (!enabled) return
  if (args.cmd === 'telemetry' || args.cmd === 'statusline') return

  /** @type {Record<string, unknown>} */
  const event = {
    v: 1,
    ts: new Date().toISOString(),
    cmd: args.cmd,
    argv_shape: argvShape(args.argv || []),
    exit: args.exit,
    ms: Math.max(0, Math.round(args.ms)),
    sage_version: packageVersion(),
    install_id: getInstallId(),
    node: String(process.versions?.node || '').split('.')[0] || '?',
    os: process.platform,
  }
  const rid = hashRepoRoot(args.repoRoot)
  if (rid) event.repo_id = rid
  if (args.judgeDesired) event.judge_desired = args.judgeDesired
  if (typeof args.judgeSatisfied === 'boolean') event.judge_satisfied = args.judgeSatisfied
  event.result = { ok: args.exit === 0 }

  emitEvent(event)
}

export function readEvents(opts = {}) {
  const file = opts.eventsPath ?? EVENTS_FILE()
  if (!fs.existsSync(file)) return []
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }
  const out = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      /* skip */
    }
  }
  return out
}

export function clearEvents(opts = {}) {
  const file = opts.eventsPath ?? EVENTS_FILE()
  try {
    if (fs.existsSync(file)) fs.writeFileSync(file, '')
    return true
  } catch {
    return false
  }
}

export function formatReport(events) {
  if (events.length === 0) return 'sage telemetry report: no events\n'
  /** @type {Map<string, { n: number, ms: number[] }>} */
  const byCmd = new Map()
  let fails = 0
  for (const ev of events) {
    const cmd = String(ev.cmd || '?')
    let row = byCmd.get(cmd)
    if (!row) {
      row = { n: 0, ms: [] }
      byCmd.set(cmd, row)
    }
    row.n++
    if (typeof ev.ms === 'number') row.ms.push(ev.ms)
    if (ev.exit !== 0) fails++
  }
  const lines = [`sage telemetry report: ${events.length} events · ${fails} non-zero exit`]
  const sorted = [...byCmd.entries()].sort((a, b) => b[1].n - a[1].n)
  for (const [cmd, row] of sorted) {
    const avg = row.ms.length
      ? Math.round(row.ms.reduce((a, b) => a + b, 0) / row.ms.length)
      : 0
    lines.push(`  ${cmd}: n=${row.n} avg_ms=${avg}`)
  }
  return `${lines.join('\n')}\n`
}

export function telemetryStatusLine() {
  const on = resolveTelemetryEnabled()
  const n = readEvents().length
  return `sage telemetry: ${on ? 'ON' : 'OFF'} · events=${n} · ${EVENTS_FILE()}`
}
