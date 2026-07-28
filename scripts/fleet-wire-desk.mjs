#!/usr/bin/env node
/**
 * Alias → scripts/fleet-desk-wire.mjs
 *
 * Task brief name: fleet-wire-desk. Canonical implementor: fleet-desk-wire
 * (preferred judge + adapters + CLAUDE/AGENTS pointers + predev atlas gate).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fleet-desk-wire.mjs')
const r = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(r.status ?? 1)
