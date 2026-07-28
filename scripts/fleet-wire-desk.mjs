#!/usr/bin/env node
/**
 * Fleet one-shot: wire preferred live judge + drop atlas adapters + optional predev.
 *
 * Steps (all soft-skippable via flags):
 *   1. preferred judge config  → scripts/fleet-wire-preferred-judge.mjs
 *   2. drop atlas adapters     → scripts/fleet-drop-atlas-adapter.mjs
 *   3. optional: set package.json "predev": "atlas gate" when missing
 *      (never forces sage into predev — sage is SessionStart + preferred)
 *
 * Usage:
 *   node scripts/fleet-wire-desk.mjs
 *   node scripts/fleet-wire-desk.mjs --dry-run
 *   node scripts/fleet-wire-desk.mjs --telemetry
 *   node scripts/fleet-wire-desk.mjs --predev
 *   node scripts/fleet-wire-desk.mjs --no-preferred --no-adapter --predev
 *   node scripts/fleet-wire-desk.mjs syndcast delieta
 *   REPOS_ROOT=~/Repositories node scripts/fleet-wire-desk.mjs --predev
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAGE_ROOT = path.resolve(__dirname, '..')
const REPOS_ROOT = process.env.REPOS_ROOT || path.resolve(SAGE_ROOT, '..')

const DRY = process.argv.includes('--dry-run')
const TEL = process.argv.includes('--telemetry')
const DO_PREDEV = process.argv.includes('--predev')
const NO_PREFERRED = process.argv.includes('--no-preferred')
const NO_ADAPTER = process.argv.includes('--no-adapter')
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'))

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

function runNode(scriptRel, extraArgs = []) {
  const script = path.join(SAGE_ROOT, scriptRel)
  const args = [script, ...(DRY ? ['--dry-run'] : []), ...extraArgs]
  if (DRY) log(`(dry-run) node ${scriptRel} ${extraArgs.join(' ')}`.trim())
  const r = spawnSync(process.execPath, args, {
    cwd: SAGE_ROOT,
    encoding: 'utf8',
    env: process.env,
    stdio: 'inherit',
  })
  return r.status ?? 1
}

function listAtlasRepos() {
  const names = ONLY.length
    ? ONLY
    : fs.readdirSync(REPOS_ROOT).filter((n) => !n.startsWith('.'))
  return names
    .map((n) => path.join(REPOS_ROOT, n))
    .filter((p) => {
      try {
        return (
          fs.statSync(p).isDirectory() &&
          fs.existsSync(path.join(p, 'atlas.config.json')) &&
          fs.existsSync(path.join(p, 'package.json'))
        )
      } catch {
        return false
      }
    })
}

/**
 * Ensure "predev": "atlas gate" when missing.
 * Does not clobber existing predev; if predev exists without atlas gate, prepend it.
 * Never injects sage gate into predev (SessionStart owns sage soft lines).
 * @param {string[]} repos
 * @param {{ dry?: boolean }} [opts]
 * @returns {{ wrote: number, skipped: number }}
 */
export function ensurePredevAtlasGate(repos, opts = {}) {
  const dry = opts.dry ?? DRY
  let wrote = 0
  let skipped = 0
  for (const repo of repos) {
    const pkgPath = path.join(repo, 'package.json')
    let pkg
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    } catch {
      skipped++
      log(`skip (bad package.json) ${path.basename(repo)}`)
      continue
    }
    pkg.scripts = pkg.scripts || {}
    const cur = pkg.scripts.predev
    let next = cur
    if (!cur) {
      next = 'atlas gate'
    } else if (
      !cur.includes('atlas gate') &&
      !cur.includes('atlas:gate') &&
      !cur.includes('desk-gate')
    ) {
      next = `atlas gate && ${cur}`
    } else {
      skipped++
      log(`skip predev (already wired) ${path.basename(repo)}`)
      continue
    }
    if (dry) {
      log(`(dry-run) predev ${path.basename(repo)}: ${JSON.stringify(next)}`)
      wrote++
      continue
    }
    pkg.scripts.predev = next
    if (!pkg.scripts.atlas) pkg.scripts.atlas = 'atlas'
    if (!pkg.scripts['atlas:gate']) pkg.scripts['atlas:gate'] = 'atlas gate'
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    wrote++
    log(`predev → ${path.basename(repo)}: ${next}`)
  }
  return { wrote, skipped }
}

function main() {
  log(`fleet-wire-desk REPOS=${REPOS_ROOT} dry=${DRY} predev=${DO_PREDEV}`)

  if (!NO_PREFERRED) {
    log('\n==> preferred judge')
    const code = runNode('scripts/fleet-wire-preferred-judge.mjs', TEL ? ['--telemetry'] : [])
    if (code !== 0 && !DRY) {
      log(`warn: fleet-wire-preferred-judge exited ${code}`)
    }
  } else {
    log('\n==> preferred judge (skipped)')
  }

  if (!NO_ADAPTER) {
    log('\n==> drop atlas adapters')
    const extra = ONLY.length ? ONLY : []
    const code = runNode('scripts/fleet-drop-atlas-adapter.mjs', extra)
    if (code !== 0 && !DRY) {
      log(`warn: fleet-drop-atlas-adapter exited ${code}`)
    }
  } else {
    log('\n==> drop atlas adapters (skipped)')
  }

  if (DO_PREDEV) {
    log('\n==> ensure predev: atlas gate')
    const repos = listAtlasRepos()
    log(`targets (${repos.length}): ${repos.map((r) => path.basename(r)).join(', ') || '∅'}`)
    const { wrote, skipped } = ensurePredevAtlasGate(repos)
    log(`predev done: wrote=${wrote} skipped=${skipped}`)
  } else {
    log('\n==> predev (skipped — pass --predev to set "atlas gate" on atlas repos)')
  }

  log('\nnext:')
  log('  keep a pane: sage judge run --fleet')
  log('  check:       sage gate && sage doctor')
  log('  optional:    node scripts/desk-gate.mjs')
  log('  consumer predev recommendation: "predev": "atlas gate"  (sage = SessionStart)')
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  main()
}
