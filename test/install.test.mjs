import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkTmp } from './helpers.mjs'

const INSTALL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'install.mjs')
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'PreCompact', 'SessionEnd', 'PreToolUse']

const runInstall = (home) =>
  execFileSync('node', [INSTALL], { encoding: 'utf8', env: { ...process.env, HOME: home } })

test('seeds default-OFF config, symlinks the hook, wires all 7 events', () => {
  const home = mkTmp('sage-h-')
  const out = runInstall(home)
  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'sage', 'config.json'), 'utf8'))
  assert.deepEqual(cfg, { enabled: false })
  const link = path.join(home, '.claude', 'hooks', 'sage-emit.mjs')
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true)
  const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'))
  for (const ev of EVENTS) assert.ok((settings.hooks[ev] || []).length >= 1, `missing ${ev}`)
  assert.match(out, /guard/i) // summary mentions the default-OFF guard
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

test('tmux bind: adds an idempotent bind j; backs up + preserves a pre-existing conf', () => {
  const home = mkTmp('sage-h-')
  const conf = path.join(home, '.tmux.conf')
  fs.writeFileSync(conf, 'set -g mouse on\n') // pre-existing unrelated config
  runInstall(home)
  const after = fs.readFileSync(conf, 'utf8')
  assert.match(after, /set -g mouse on/) // preserved
  assert.match(after, /bind j .*sage.* board/) // our bind added
  assert.equal(fs.readFileSync(conf + '.bak', 'utf8'), 'set -g mouse on\n') // backed up pristine
  // idempotent: a second run does not duplicate the bind
  runInstall(home)
  const binds = (fs.readFileSync(conf, 'utf8').match(/bind j /g) || []).length
  assert.equal(binds, 1)
})

test('malformed settings.json → abort, original left intact', () => {
  const home = mkTmp('sage-h-')
  const claude = path.join(home, '.claude')
  fs.mkdirSync(claude, { recursive: true })
  const sp = path.join(claude, 'settings.json')
  fs.writeFileSync(sp, '{ bad json,, }')
  assert.throws(() => runInstall(home)) // exit 1 → execFileSync throws
  assert.equal(fs.readFileSync(sp, 'utf8'), '{ bad json,, }') // never overwritten
})

test('symlinks the sage-fleet skill into ~/.claude/skills', () => {
  const home = mkTmp('sage-h-')
  runInstall(home)
  const slink = path.join(home, '.claude', 'skills', 'sage-fleet')
  assert.equal(fs.lstatSync(slink).isSymbolicLink(), true)
  // resolves to the repo skill (SKILL.md readable through the link)
  assert.match(fs.readFileSync(path.join(slink, 'SKILL.md'), 'utf8'), /name:\s*sage-fleet/)
})

test('SAGE_SKIP_SKILL=1 skips the skill symlink', () => {
  const home = mkTmp('sage-h-')
  execFileSync('node', [INSTALL], { encoding: 'utf8', env: { ...process.env, HOME: home, SAGE_SKIP_SKILL: '1' } })
  assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'sage-fleet')), false)
})

test('skill symlink is non-clobbering: backs up a real dir, leaves foreign skills', () => {
  const home = mkTmp('sage-h-')
  const skills = path.join(home, '.claude', 'skills')
  fs.mkdirSync(path.join(skills, 'sage-fleet'), { recursive: true })
  fs.writeFileSync(path.join(skills, 'sage-fleet', 'mine.md'), 'hand-written') // a real dir we did not create
  fs.mkdirSync(path.join(skills, 'other'), { recursive: true })
  fs.writeFileSync(path.join(skills, 'other', 'SKILL.md'), 'foreign') // unrelated skill
  runInstall(home)
  assert.equal(fs.lstatSync(path.join(skills, 'sage-fleet')).isSymbolicLink(), true) // now linked
  assert.equal(fs.readFileSync(path.join(skills, 'sage-fleet.bak', 'mine.md'), 'utf8'), 'hand-written') // backed up
  assert.equal(fs.readFileSync(path.join(skills, 'other', 'SKILL.md'), 'utf8'), 'foreign') // untouched
})

test('skill symlink is idempotent: second run keeps one link, no second .bak', () => {
  const home = mkTmp('sage-h-')
  runInstall(home)
  runInstall(home)
  const slink = path.join(home, '.claude', 'skills', 'sage-fleet')
  assert.equal(fs.lstatSync(slink).isSymbolicLink(), true)
  assert.equal(fs.existsSync(slink + '.bak'), false) // nothing real was ever clobbered
})
