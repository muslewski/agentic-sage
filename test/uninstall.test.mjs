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

test('uninstall: exact-signature matching keeps a bundled foreign hook + a substring-only foreign hook', () => {
  const home = mkTmp('sage-un2-')
  const sdir = path.join(home, '.claude')
  const hookFile = path.join(sdir, 'hooks', 'sage-emit.mjs')
  fs.mkdirSync(path.join(sdir, 'hooks'), { recursive: true })
  // one event, two groups: (a) our sage hook bundled with a foreign hook in ONE
  // group; (b) a foreign hook whose command merely contains the 'sage-emit' token.
  fs.writeFileSync(
    path.join(sdir, 'settings.json'),
    JSON.stringify({
      hooks: {
        SessionStart: [
          {
            hooks: [
              { type: 'command', command: `"node" "${hookFile}"` }, // ours → must go
              { type: 'command', command: 'echo bundled-foreign' }, // bundled foreign → must stay
            ],
          },
          { hooks: [{ type: 'command', command: 'echo sage-emitted-log' }] }, // substring-only → must stay
        ],
      },
    }),
  )
  runScript('uninstall/uninstall.mjs', home)
  const s = JSON.parse(fs.readFileSync(path.join(sdir, 'settings.json'), 'utf8'))
  const cmds = s.hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command))
  assert.equal(cmds.some((c) => c.includes(hookFile)), false) // our hook removed
  assert.ok(cmds.includes('echo bundled-foreign')) // bundled foreign survived (inner-level filter)
  assert.ok(cmds.includes('echo sage-emitted-log')) // substring-only survived (exact-path match)
})

test('uninstall: tmux removes only the exact SAGE bind, keeps a user keyboard line', () => {
  const home = mkTmp('sage-un3-')
  const sdir = path.join(home, '.claude')
  fs.mkdirSync(sdir, { recursive: true })
  fs.writeFileSync(path.join(sdir, 'settings.json'), '{}')
  const tmux = path.join(home, '.tmux.conf')
  fs.writeFileSync(tmux, 'bind-key C-k run-shell "~/bin/sage --keyboard-mode"\n') // user line: bin/sage + keyboard
  runScript('install.mjs', home)
  const sageBoard = path.join(root, 'bin', 'sage') + ' board'
  assert.ok(fs.readFileSync(tmux, 'utf8').includes(sageBoard)) // install added the bind
  runScript('uninstall/uninstall.mjs', home)
  const conf = fs.readFileSync(tmux, 'utf8')
  assert.ok(conf.includes('--keyboard-mode')) // user keyboard line survived
  assert.equal(conf.includes(sageBoard), false) // the SAGE bind removed
})
