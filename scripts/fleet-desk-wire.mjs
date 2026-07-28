#!/usr/bin/env node
/**
 * Fleet desk wire — one-shot manjaro desk setup for preferred-judge fleet.
 *
 * Orchestrates:
 *   1. preferred judge + telemetry ON  (fleet-wire-preferred-judge --telemetry)
 *   2. drop adapters on all atlas siblings  (fleet-drop-atlas-adapter)
 *   3. inject sage pointers into CLAUDE.md / AGENTS.md
 *   4. ensure predev has atlas gate; optional //sage note (gate is global)
 *   5. write report → agentic-sage-mind/reports/fleet-desk-wire.json
 *
 * Idempotent. No per-repo git commits.
 *
 * Usage:
 *   node scripts/fleet-desk-wire.mjs
 *   node scripts/fleet-desk-wire.mjs --dry-run
 *   node scripts/fleet-desk-wire.mjs syndcast delieta
 *   REPOS_ROOT=~/Repositories node scripts/fleet-desk-wire.mjs
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAGE_ROOT = path.resolve(__dirname, '..')
const REPOS_ROOT = process.env.REPOS_ROOT || path.resolve(SAGE_ROOT, '..')
const DRY = process.argv.includes('--dry-run')
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'))

const REPORT_PATH = path.join(SAGE_ROOT, 'agentic-sage-mind', 'reports', 'fleet-desk-wire.json')

const POINTER_RE = /sage-fleet|<!--\s*SAGE\s*[—-]|agentic-sage\s*—\s*optional/i
const SAGE_GATE_NOTE =
  'global only — sage gate (preferred judge) is machine-level; not chained into predev. run: sage gate'

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

function writeText(p, body) {
  if (DRY) {
    log(`  (dry-run) write ${p}`)
    return
  }
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, body)
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(p, obj) {
  writeText(p, `${JSON.stringify(obj, null, 2)}\n`)
}

function listAtlasRepos() {
  const names = ONLY.length
    ? ONLY
    : fs.readdirSync(REPOS_ROOT).filter((n) => !n.startsWith('.'))
  return names
    .map((n) => ({ name: n, root: path.join(REPOS_ROOT, n) }))
    .filter(({ root }) => {
      try {
        return fs.statSync(root).isDirectory() && fs.existsSync(path.join(root, 'atlas.config.json'))
      } catch {
        return false
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function runSiblingScript(scriptName, extraArgs = []) {
  const script = path.join(SAGE_ROOT, 'scripts', scriptName)
  const args = [script, ...extraArgs]
  if (DRY) args.push('--dry-run')
  if (ONLY.length) args.push(...ONLY)
  log(`\n→ node ${path.relative(SAGE_ROOT, script)} ${extraArgs.join(' ')}${DRY ? ' --dry-run' : ''}${ONLY.length ? ` ${ONLY.join(' ')}` : ''}`)
  const r = spawnSync(process.execPath, args, {
    cwd: SAGE_ROOT,
    encoding: 'utf8',
    env: { ...process.env, REPOS_ROOT },
    timeout: 120_000,
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  return {
    status: r.status ?? 1,
    error: r.error?.message || (r.status === 0 ? null : `exit ${r.status}`),
  }
}

// ── 1. preferred judge + telemetry ─────────────────────────────────────────

function stepPreferredJudge() {
  // Call existing script with --telemetry (preferred + local telemetry on).
  return runSiblingScript('fleet-wire-preferred-judge.mjs', ['--telemetry'])
}

// ── 2. drop adapters ───────────────────────────────────────────────────────

function stepDropAdapters() {
  return runSiblingScript('fleet-drop-atlas-adapter.mjs')
}

// ── 3. inject sage pointers ────────────────────────────────────────────────

function loadSnippets() {
  const claude = readText(path.join(SAGE_ROOT, 'templates', 'CLAUDE.snippet.md'))
  const grok = readText(path.join(SAGE_ROOT, 'templates', 'GROK.snippet.md'))
  if (!claude || !grok) {
    throw new Error('missing templates/CLAUDE.snippet.md or templates/GROK.snippet.md')
  }
  return { claude: claude.trimEnd() + '\n', grok: grok.trimEnd() + '\n' }
}

function injectPointer(filePath, snippet) {
  const existing = readText(filePath)
  if (existing === null) {
    return { action: 'missing', path: filePath }
  }
  if (POINTER_RE.test(existing)) {
    return { action: 'skip', path: filePath }
  }
  const sep = existing.endsWith('\n') ? '\n' : '\n\n'
  const next = `${existing}${sep}${snippet}`
  writeText(filePath, next.endsWith('\n') ? next : `${next}\n`)
  return { action: DRY ? 'would-write' : 'wrote', path: filePath }
}

function stepInjectPointers(repos) {
  const snippets = loadSnippets()
  const results = []
  for (const { name, root } of repos) {
    const claude = injectPointer(path.join(root, 'CLAUDE.md'), snippets.claude)
    const agents = injectPointer(path.join(root, 'AGENTS.md'), snippets.grok)
    results.push({ name, claude, agents })
    log(
      `  ${name}: CLAUDE=${claude.action} AGENTS=${agents.action}`,
    )
  }
  return results
}

// ── 4. predev atlas gate + optional sage-global note ───────────────────────

function ensurePredev(repoRoot) {
  const pkgPath = path.join(repoRoot, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    return { action: 'no-package.json' }
  }
  const pkg = readJson(pkgPath)
  if (!pkg || typeof pkg !== 'object') {
    return { action: 'invalid-package.json' }
  }

  pkg.scripts = pkg.scripts || {}
  const before = { ...pkg.scripts }
  const changes = []

  // atlas:gate thin script
  if (!pkg.scripts['atlas:gate']) {
    pkg.scripts['atlas:gate'] = 'atlas gate'
    changes.push('add atlas:gate')
  }

  // predev: soft gate — set if missing; prepend if present without atlas gate
  const pre = pkg.scripts.predev
  if (!pre) {
    pkg.scripts.predev = 'atlas gate'
    changes.push('set predev=atlas gate')
  } else if (!pre.includes('atlas gate') && !pre.includes('atlas:gate')) {
    pkg.scripts.predev = `atlas gate && ${pre}`
    changes.push('prepend atlas gate to predev')
  }

  // Optional comment: sage gate is machine-global, not chained into predev.
  // package.json has no real comments — npm-style "//…" keys are the convention.
  const noteKey = '//sage-gate'
  if (pkg.scripts[noteKey] !== SAGE_GATE_NOTE) {
    if (pkg.scripts[noteKey] == null) {
      pkg.scripts[noteKey] = SAGE_GATE_NOTE
      changes.push('add //sage-gate note')
    }
    // if a different note exists, leave it (don't clobber human edits)
  }

  if (changes.length === 0) {
    return { action: 'skip', predev: pkg.scripts.predev }
  }

  if (DRY) {
    log(`  (dry-run) package.json ${path.basename(repoRoot)}: ${changes.join('; ')}`)
    return { action: 'would-write', changes, predev: pkg.scripts.predev, before: before.predev }
  }

  // Preserve key order roughly: rewrite scripts with //sage-gate near predev if we added it
  writeJson(pkgPath, pkg)
  return {
    action: 'wrote',
    changes,
    predev: pkg.scripts.predev,
    before: before.predev,
  }
}

function stepPredev(repos) {
  const results = []
  for (const { name, root } of repos) {
    const r = ensurePredev(root)
    results.push({ name, ...r })
    log(`  ${name}: predev ${r.action}${r.changes ? ` (${r.changes.join('; ')})` : r.predev ? ` [${r.predev}]` : ''}`)
  }
  return results
}

// ── 5. report ──────────────────────────────────────────────────────────────

function writeReport(report) {
  // Always write report (including dry-run) so the operator can inspect intent.
  if (DRY) {
    log(`\n(dry-run) would write report ${REPORT_PATH}`)
    log(JSON.stringify(report, null, 2))
  }
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  log(`report: ${REPORT_PATH}`)
}

// ── main ───────────────────────────────────────────────────────────────────

function main() {
  log(`fleet-desk-wire REPOS=${REPOS_ROOT} dry=${DRY}${ONLY.length ? ` only=${ONLY.join(',')}` : ''}`)

  const repos = listAtlasRepos()
  log(`atlas siblings (${repos.length}): ${repos.map((r) => r.name).join(', ')}`)

  const report = {
    at: new Date().toISOString(),
    dryRun: DRY,
    reposRoot: REPOS_ROOT,
    sageRoot: SAGE_ROOT,
    targets: repos.map((r) => r.name),
    steps: {},
  }

  // 1
  log('\n=== 1/5 preferred judge + telemetry ===')
  report.steps.preferredJudge = stepPreferredJudge()

  // 2
  log('\n=== 2/5 drop atlas adapters ===')
  report.steps.dropAdapters = stepDropAdapters()

  // 3
  log('\n=== 3/5 inject sage pointers (CLAUDE.md / AGENTS.md) ===')
  report.steps.pointers = stepInjectPointers(repos)

  // 4
  log('\n=== 4/5 ensure predev has atlas gate (+ //sage-gate note) ===')
  report.steps.predev = stepPredev(repos)

  // 5
  log('\n=== 5/5 report ===')
  const summary = {
    preferredJudgeOk: report.steps.preferredJudge.status === 0,
    dropAdaptersOk: report.steps.dropAdapters.status === 0,
    pointersWrote: report.steps.pointers.filter(
      (p) => p.claude.action === 'wrote' || p.agents.action === 'wrote' || p.claude.action === 'would-write' || p.agents.action === 'would-write',
    ).length,
    pointersSkipped: report.steps.pointers.filter(
      (p) => p.claude.action === 'skip' && p.agents.action === 'skip',
    ).length,
    predevWrote: report.steps.predev.filter((p) => p.action === 'wrote' || p.action === 'would-write').length,
    predevSkipped: report.steps.predev.filter((p) => p.action === 'skip').length,
  }
  report.summary = summary
  writeReport(report)

  log(
    `\n=== summary: preferred=${summary.preferredJudgeOk ? 'ok' : 'fail'} adapters=${summary.dropAdaptersOk ? 'ok' : 'fail'} pointers wrote=${summary.pointersWrote} skip=${summary.pointersSkipped} predev wrote=${summary.predevWrote} skip=${summary.predevSkipped} ===`,
  )
  log('next: sage gate && sage doctor · keep a pane with `sage judge run --fleet`')
  log('(no per-repo commits — ship separately if desired)')

  const hardFail =
    report.steps.preferredJudge.status !== 0 || report.steps.dropAdapters.status !== 0
  process.exit(hardFail ? 1 : 0)
}

main()
