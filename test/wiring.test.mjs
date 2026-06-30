import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { wireAll } from '../lib/wiring.mjs'
import { mkTmp } from './helpers.mjs'

// The real repo root — skills/ and hooks/ must exist for symlink tests.
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'PreCompact', 'SessionEnd', 'PreToolUse']

test('wireAll: returns expected result shape', () => {
  const home = mkTmp('sage-w-')
  const r = wireAll({ home, repoRoot: REPO_ROOT })
  assert.ok(r.gc.includes('sage'))
  assert.ok(r.link.includes('sage-emit.mjs'))
  assert.ok(r.target.endsWith('hooks/sage-emit.mjs'))
  assert.ok(r.settingsPath.endsWith('settings.json'))
  assert.ok(typeof r.tmuxNote === 'string')
  assert.ok(typeof r.skillNote === 'string')
  assert.ok(r.sageBin.endsWith('bin/sage'))
})

test('wireAll: seeds default-OFF config and wires all 7 hook events', () => {
  const home = mkTmp('sage-w-')
  wireAll({ home, repoRoot: REPO_ROOT })
  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'sage', 'config.json'), 'utf8'))
  assert.deepEqual(cfg, { enabled: false })
  const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'))
  for (const ev of EVENTS) assert.ok((settings.hooks[ev] || []).length >= 1, `missing ${ev}`)
})

test('wireAll: idempotent — second call adds no duplicate hooks', () => {
  const home = mkTmp('sage-w-')
  wireAll({ home, repoRoot: REPO_ROOT })
  wireAll({ home, repoRoot: REPO_ROOT })
  const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'))
  assert.equal(settings.hooks.Stop.length, 1)
})

test('wireAll: idempotent — second call does not overwrite existing config', () => {
  const home = mkTmp('sage-w-')
  wireAll({ home, repoRoot: REPO_ROOT })
  const cfg1 = fs.readFileSync(path.join(home, '.claude', 'sage', 'config.json'), 'utf8')
  wireAll({ home, repoRoot: REPO_ROOT })
  const cfg2 = fs.readFileSync(path.join(home, '.claude', 'sage', 'config.json'), 'utf8')
  assert.equal(cfg1, cfg2)
})

test('wireAll: malformed settings.json throws, file is left intact', () => {
  const home = mkTmp('sage-w-')
  const claude = path.join(home, '.claude')
  fs.mkdirSync(claude, { recursive: true })
  const sp = path.join(claude, 'settings.json')
  fs.writeFileSync(sp, '{ bad json,, }')
  assert.throws(() => wireAll({ home, repoRoot: REPO_ROOT }), /ABORTED/)
  assert.equal(fs.readFileSync(sp, 'utf8'), '{ bad json,, }')
})

test('wireAll: skipSkill=true skips the skill symlink', () => {
  const home = mkTmp('sage-w-')
  wireAll({ home, repoRoot: REPO_ROOT, skipSkill: true })
  assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'sage-fleet')), false)
})

test('wireAll: symlinks skills into ~/.claude/skills', () => {
  const home = mkTmp('sage-w-')
  wireAll({ home, repoRoot: REPO_ROOT })
  const slink = path.join(home, '.claude', 'skills', 'sage-fleet')
  assert.equal(fs.lstatSync(slink).isSymbolicLink(), true)
  assert.match(fs.readFileSync(path.join(slink, 'SKILL.md'), 'utf8'), /name:\s*sage-fleet/)
})

test('wireAll: hook symlink — real-file collision backed up, relinked', () => {
  const home = mkTmp('sage-w-')
  const hooksDir = path.join(home, '.claude', 'hooks')
  fs.mkdirSync(hooksDir, { recursive: true })
  const link = path.join(hooksDir, 'sage-emit.mjs')
  fs.writeFileSync(link, '// original')
  wireAll({ home, repoRoot: REPO_ROOT })
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true)
  assert.equal(fs.readFileSync(link + '.bak', 'utf8'), '// original')
})
