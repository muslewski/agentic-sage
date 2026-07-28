#!/usr/bin/env node
/**
 * OSS-friendly dual desk gate — soft `atlas gate` + soft `sage gate`.
 *
 * Never hard-depends on either tool:
 *   - if `atlas` on PATH (or ./node_modules/.bin) AND `atlas.config.json` in
 *     cwd or an ancestor → spawn `atlas gate`
 *   - if `sage` on PATH (or ./node_modules/.bin) → spawn `sage gate`
 *   - neither present → exit 0 (fail-open)
 *
 * Exit codes:
 *   - default: always 0 (child findings are printed; never block dev)
 *   - `--strict`: exit 1 only when a *present* gate returns non-zero
 *     (missing tools still soft-skip)
 *
 * Consumer predev recommendation (see SETUP.md):
 *   "predev": "atlas gate"          // vault freshness when you use Atlas
 *   sage is global SessionStart + preferred — not required in predev
 *
 * Optional one-liner when you want both soft checks without `|| true` tricks:
 *   "predev": "node path/to/agentic-sage/scripts/desk-gate.mjs"
 *   // or, from a clone: "predev": "node scripts/desk-gate.mjs"
 *
 * Usage:
 *   node scripts/desk-gate.mjs
 *   node scripts/desk-gate.mjs --strict
 */
import { spawnSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * @param {string} cmd
 * @returns {string | null}
 */
export function which(cmd) {
  try {
    const out = execFileSync('sh', ['-c', `command -v ${JSON.stringify(cmd)}`], {
      encoding: 'utf8',
    }).trim()
    return out || null
  } catch {
    return null
  }
}

/**
 * PATH first, then cwd (and parents) node_modules/.bin/<cmd>.
 * @param {string} cmd
 * @param {string} cwd
 * @returns {string | null}
 */
export function resolveBin(cmd, cwd) {
  const onPath = which(cmd)
  if (onPath) return onPath
  let dir = path.resolve(cwd)
  for (;;) {
    const local = path.join(dir, 'node_modules', '.bin', cmd)
    if (fs.existsSync(local)) return local
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Walk cwd → parents for atlas.config.json (stop at filesystem root).
 * @param {string} start
 * @returns {string | null} directory containing atlas.config.json
 */
export function findAtlasConfigDir(start) {
  let dir = path.resolve(start)
  for (;;) {
    if (fs.existsSync(path.join(dir, 'atlas.config.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * @param {string[]} argv
 * @param {{
 *   cwd?: string,
 *   stdout?: { write: Function },
 *   stderr?: { write: Function },
 *   which?: (cmd: string) => string | null,
 *   resolveBin?: (cmd: string, cwd: string) => string | null,
 *   spawn?: typeof spawnSync,
 *   env?: NodeJS.ProcessEnv,
 * }} [opts]
 * @returns {number}
 */
export function runDeskGate(argv = [], opts = {}) {
  const cwd = opts.cwd ?? process.cwd()
  const stdout = opts.stdout ?? process.stdout
  const stderr = opts.stderr ?? process.stderr
  const resolve =
    opts.resolveBin ??
    ((cmd, c) => {
      if (opts.which) {
        // tests inject which only — honor that as full resolver
        return opts.which(cmd)
      }
      return resolveBin(cmd, c)
    })
  const spawn = opts.spawn ?? spawnSync
  const env = opts.env ?? process.env
  const strict = Array.isArray(argv) && argv.includes('--strict')
  const childExtra = strict ? ['--strict'] : []

  let ran = 0
  let failed = 0

  const run = (bin, args, label) => {
    ran++
    const r = spawn(bin, args, {
      cwd,
      env,
      encoding: 'utf8',
      stdio: opts.stdout || opts.stderr ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    if (opts.stdout || opts.stderr) {
      if (r.stdout) stdout.write(String(r.stdout))
      if (r.stderr) stderr.write(String(r.stderr))
    }
    if (r.error) {
      stdout.write(`desk-gate: skip ${label} (${r.error.code || r.error.message})\n`)
      ran--
      return
    }
    const code = r.status ?? 1
    if (code !== 0) {
      failed++
      if (strict) {
        stderr.write(`desk-gate: ${label} exited ${code}\n`)
      }
    }
  }

  const atlasDir = findAtlasConfigDir(cwd)
  const atlasBin = resolve('atlas', cwd)
  if (atlasBin && atlasDir) {
    run(atlasBin, ['gate', ...childExtra], 'atlas gate')
  }

  const sageBin = resolve('sage', cwd)
  if (sageBin) {
    run(sageBin, ['gate', ...childExtra], 'sage gate')
  }

  if (ran === 0) {
    stdout.write('desk-gate: no desk tools ran (ok — install atlas and/or sage when ready)\n')
    return 0
  }

  if (strict && failed > 0) {
    stderr.write(`desk-gate: fail (strict) — ${failed}/${ran} gate(s) non-zero\n`)
    return 1
  }

  if (failed === 0) {
    stdout.write('desk-gate: ok\n')
  }
  return 0
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  process.exit(runDeskGate(process.argv.slice(2)))
}
