#!/usr/bin/env node
/**
 * Fleet: set judge.desired=preferred on this machine's sage global config.
 * Optional: enable local telemetry.
 *
 * Usage:
 *   node scripts/fleet-wire-preferred-judge.mjs
 *   node scripts/fleet-wire-preferred-judge.mjs --telemetry
 *   node scripts/fleet-wire-preferred-judge.mjs --dry-run
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DRY = process.argv.includes('--dry-run')
const TEL = process.argv.includes('--telemetry')
const home = process.env.HOME || os.homedir()
const sageHome = path.join(home, '.claude', 'agentic-sage')
const cfgPath = path.join(sageHome, 'config.json')
const machineCfg = path.join(home, '.config', 'agentic-sage', 'config.json')

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

function writeJson(p, obj) {
  if (DRY) {
    console.log(`(dry-run) write ${p}`)
    console.log(JSON.stringify(obj, null, 2))
    return
  }
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`)
}

const cur = readJson(cfgPath)
const next = {
  ...cur,
  enabled: cur.enabled === false ? false : true,
  judge: {
    ...(typeof cur.judge === 'object' && cur.judge ? cur.judge : {}),
    desired: 'preferred',
    warnIfOffline: true,
    scope: cur.judge?.scope || 'auto',
    harness: cur.judge?.harness || 'auto',
  },
}
if (next.enabled !== true) {
  console.log('note: global sage is not enabled — set enabled:true or run sage on')
}

writeJson(cfgPath, next)
console.log(`sage judge.desired=preferred → ${cfgPath}`)

if (TEL) {
  const m = readJson(machineCfg)
  writeJson(machineCfg, {
    ...m,
    telemetry: { enabled: true, level: 'debug' },
  })
  console.log(`telemetry ON → ${machineCfg}`)
}

console.log('next: keep a pane with `sage judge run --fleet` (or --harness none)')
console.log('check: sage gate && sage doctor')

void fileURLToPath
