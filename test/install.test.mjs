import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkTmp } from './helpers.mjs'

const INSTALL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'install.mjs')
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'PreCompact', 'SessionEnd']

const runInstall = (home) =>
  execFileSync('node', [INSTALL], { encoding: 'utf8', env: { ...process.env, HOME: home } })

test('seeds default-OFF config, symlinks the hook, wires all 6 events', () => {
  const home = mkTmp('sage-h-')
  runInstall(home)
  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'sage', 'config.json'), 'utf8'))
  assert.deepEqual(cfg, { enabled: false })
  const link = path.join(home, '.claude', 'hooks', 'sage-emit.mjs')
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true)
  const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'))
  for (const ev of EVENTS) assert.ok((settings.hooks[ev] || []).length >= 1, `missing ${ev}`)
})

test('idempotent: a second run adds no duplicate hook', () => {
  const home = mkTmp('sage-h-')
  runInstall(home)
  runInstall(home)
  const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'))
  assert.equal(settings.hooks.Stop.length, 1)
})

test('preserves a pre-existing unrelated hook and never enables', () => {
  const home = mkTmp('sage-h-')
  const claude = path.join(home, '.claude')
  fs.mkdirSync(claude, { recursive: true })
  fs.writeFileSync(
    path.join(claude, 'settings.json'),
    JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo other' }] }] } }),
  )
  runInstall(home)
  const settings = JSON.parse(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8'))
  const cmds = settings.hooks.Stop.flatMap((g) => g.hooks.map((h) => h.command))
  assert.ok(cmds.includes('echo other'))
  assert.equal(cmds.length, 2)
  const cfg = JSON.parse(fs.readFileSync(path.join(claude, 'sage', 'config.json'), 'utf8'))
  assert.equal(cfg.enabled, false)
})
