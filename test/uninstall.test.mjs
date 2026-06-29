import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkTmp } from './helpers.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const node = process.execPath
const runScript = (script, home) =>
  execFileSync(node, [path.join(root, script)], { env: { ...process.env, HOME: home }, encoding: 'utf8' })

test('uninstall removes sage wiring, keeps foreign hooks + state', () => {
  const home = mkTmp('sage-un-')
  // seed a foreign settings.json (a non-sage SessionStart hook + a model key)
  const sdir = path.join(home, '.claude')
  fs.mkdirSync(sdir, { recursive: true })
  fs.writeFileSync(
    path.join(sdir, 'settings.json'),
    JSON.stringify({
      model: 'opus',
      hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo foreign' }] }] },
    }),
  )
  runScript('install.mjs', home)
  // sanity: install added sage-emit refs + the hook/skill symlinks
  let s = JSON.parse(fs.readFileSync(path.join(sdir, 'settings.json'), 'utf8'))
  assert.ok(JSON.stringify(s).includes('sage-emit'))
  assert.ok(fs.existsSync(path.join(sdir, 'hooks', 'sage-emit.mjs')))

  runScript('uninstall/uninstall.mjs', home)
  s = JSON.parse(fs.readFileSync(path.join(sdir, 'settings.json'), 'utf8'))
  assert.equal(JSON.stringify(s).includes('sage-emit'), false) // 0 sage refs
  assert.equal(s.model, 'opus') // foreign key intact
  assert.ok(s.hooks.SessionStart.some((g) => g.hooks.some((h) => h.command === 'echo foreign'))) // foreign hook intact
  assert.equal(fs.existsSync(path.join(sdir, 'hooks', 'sage-emit.mjs')), false) // hook symlink gone
  assert.equal(fs.existsSync(path.join(sdir, 'skills', 'sage-doctor')), false) // skill symlink gone
  assert.ok(fs.existsSync(path.join(sdir, 'sage'))) // state kept
})
