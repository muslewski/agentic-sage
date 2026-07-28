#!/usr/bin/env node
/**
 * Drop memory-atlas example sage adapter into sibling repos that have atlas.config.json.
 *
 * Usage:
 *   node scripts/fleet-drop-atlas-adapter.mjs
 *   node scripts/fleet-drop-atlas-adapter.mjs --dry-run
 *   node scripts/fleet-drop-atlas-adapter.mjs syndcast delieta
 *   REPOS_ROOT=~/Repositories node scripts/fleet-drop-atlas-adapter.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAGE_ROOT = path.resolve(__dirname, '..')
const REPOS_ROOT = process.env.REPOS_ROOT || path.resolve(SAGE_ROOT, '..')
const DRY = process.argv.includes('--dry-run')
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'))

// Prefer memory-atlas example if present; else ship adapters/acme is project-specific.
const CANDIDATES = [
  path.join(REPOS_ROOT, 'memory-atlas', 'examples', 'with-agentic-sage', 'adapter.mjs'),
  path.join(SAGE_ROOT, 'adapters', 'acme.mjs'),
]

function findSource() {
  for (const p of CANDIDATES) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function listRepos() {
  const names = ONLY.length
    ? ONLY
    : fs.readdirSync(REPOS_ROOT).filter((n) => !n.startsWith('.'))
  return names
    .map((n) => path.join(REPOS_ROOT, n))
    .filter((p) => {
      try {
        return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'atlas.config.json'))
      } catch {
        return false
      }
    })
}

const src = findSource()
if (!src) {
  console.error('no adapter source found (memory-atlas examples or adapters/acme.mjs)')
  process.exit(1)
}

const body = fs.readFileSync(src, 'utf8')
let wrote = 0
let skipped = 0

for (const repo of listRepos()) {
  const destDir = path.join(repo, '.agentic-sage')
  const dest = path.join(destDir, 'adapter.mjs')
  if (fs.existsSync(dest)) {
    skipped++
    console.log(`skip (exists) ${path.basename(repo)}`)
    continue
  }
  if (DRY) {
    console.log(`(dry-run) write ${dest}`)
    wrote++
    continue
  }
  fs.mkdirSync(destDir, { recursive: true })
  fs.writeFileSync(dest, body)
  wrote++
  console.log(`wrote ${path.basename(repo)}/.agentic-sage/adapter.mjs`)
}

console.log(`done: wrote=${wrote} skipped=${skipped} source=${src}`)
