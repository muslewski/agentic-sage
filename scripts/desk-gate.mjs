#!/usr/bin/env node
/**
 * Soft dual gate for a product repo desk: past (atlas) + present (sage).
 *
 * - If cwd has atlas.config.json and `atlas` is on PATH → run `atlas gate`
 * - If `sage` is on PATH → run `sage gate`
 * - Missing tools: skip (fail-open)
 * - Default: exit 0 even with soft warnings
 * - `--strict`: exit 1 if either child exits non-zero
 *
 * Usage:
 *   node scripts/desk-gate.mjs
 *   node scripts/desk-gate.mjs --strict
 *   # or after global install: add to package.json predev when both tools exist
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const strict = process.argv.includes('--strict')
const cwd = process.cwd()

function which(cmd) {
  const r = spawnSync('sh', ['-c', `command -v ${JSON.stringify(cmd)}`], {
    encoding: 'utf8',
  })
  return r.status === 0 ? String(r.stdout || '').trim() : ''
}

function run(bin, args) {
  const r = spawnSync(bin, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    timeout: 60_000,
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  return r.status ?? 1
}

let code = 0
const atlasCfg = path.join(cwd, 'atlas.config.json')
const hasAtlas = fs.existsSync(atlasCfg)
const atlasBin = which('atlas')
const sageBin = which('sage')

if (hasAtlas && atlasBin) {
  const c = run(atlasBin, strict ? ['gate', '--strict'] : ['gate'])
  if (c !== 0) code = c
} else if (hasAtlas && !atlasBin) {
  process.stdout.write('desk-gate: atlas.config.json present but atlas not on PATH (skip)\n')
}

if (sageBin) {
  const c = run(sageBin, strict ? ['gate', '--strict'] : ['gate'])
  if (c !== 0) code = c
} else {
  process.stdout.write('desk-gate: sage not on PATH (skip) — npm i -g agentic-sage\n')
}

if (!hasAtlas && !sageBin) {
  process.stdout.write('desk-gate: nothing to check\n')
}

process.exit(strict ? code : 0)
