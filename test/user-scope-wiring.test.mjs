import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import {
  inspectUserScopeWiring,
  userScopeWiringChecks,
  isWorktreePath,
  isNvmPinnedPath,
  stabilizePackageRoot,
  extractCommandPaths,
} from '../lib/user-scope-wiring.mjs'
import { doctor, renderDoctor } from '../lib/control.mjs'
import { wireAll } from '../lib/wiring.mjs'

const seedClaude = (home) => {
  const claude = path.join(home, '.claude')
  fs.mkdirSync(path.join(claude, 'hooks'), { recursive: true })
  fs.mkdirSync(path.join(claude, 'skills'), { recursive: true })
  return claude
}

test('classifiers: worktree + nvm path shapes', () => {
  assert.equal(isWorktreePath('/r/.claude/worktrees/foo/hooks/x.mjs'), true)
  assert.equal(isWorktreePath('/r/worktrees/foo/hooks/x.mjs'), true)
  assert.equal(isWorktreePath('/r/hooks/x.mjs'), false)
  assert.equal(isNvmPinnedPath('/h/.nvm/versions/node/v22.12.0/lib/node_modules/x'), true)
  assert.equal(isNvmPinnedPath('/usr/local/lib/node_modules/x'), false)
})

test('extractCommandPaths pulls quoted absolute paths', () => {
  const cmd = `"/usr/bin/node" "/tmp/home/.claude/hooks/agentic-sage-emit.mjs"`
  assert.deepEqual(extractCommandPaths(cmd), [
    '/usr/bin/node',
    '/tmp/home/.claude/hooks/agentic-sage-emit.mjs',
  ])
})

test('fail-open: no .claude → clean skip note', () => {
  const home = mkTmp('sage-usw-')
  const { findings, note } = inspectUserScopeWiring(home)
  assert.equal(findings.length, 0)
  assert.match(note, /no ~\/\.claude/)
  const rows = userScopeWiringChecks(home)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].ok, true)
})

test('fail-open: malformed settings.json does not throw', () => {
  const home = mkTmp('sage-usw-')
  const claude = seedClaude(home)
  fs.writeFileSync(path.join(claude, 'settings.json'), '{not json')
  assert.doesNotThrow(() => inspectUserScopeWiring(home))
  const { findings } = inspectUserScopeWiring(home)
  assert.ok(findings.some((f) => f.kind === 'settings-malformed'))
  assert.doesNotThrow(() => doctor(home, mkTmp('sage-norepo-')))
})

test('dangling symlink → broken finding', () => {
  const home = mkTmp('sage-usw-')
  seedClaude(home)
  const link = path.join(home, '.claude', 'hooks', 'agentic-sage-emit.mjs')
  fs.symlinkSync(path.join(home, 'gone', 'emit.mjs'), link)
  const { findings } = inspectUserScopeWiring(home)
  const d = findings.find((f) => f.kind === 'dangling')
  assert.ok(d)
  assert.equal(d.severity, 'broken')
  assert.match(d.detail, /dangling/)
  assert.ok(d.fix)
})

test('worktree-targeted symlink that resolves → warn (not broken mark)', () => {
  const home = mkTmp('sage-usw-')
  seedClaude(home)
  const targetDir = path.join(home, 'repo', '.claude', 'worktrees', 'feat', 'hooks')
  fs.mkdirSync(targetDir, { recursive: true })
  const target = path.join(targetDir, 'agentic-sage-emit.mjs')
  fs.writeFileSync(target, '// ok\n')
  const link = path.join(home, '.claude', 'hooks', 'agentic-sage-emit.mjs')
  fs.symlinkSync(target, link)
  const { findings } = inspectUserScopeWiring(home)
  const w = findings.find((f) => f.kind === 'worktree')
  assert.ok(w)
  assert.equal(w.severity, 'warn')
  assert.equal(findings.some((f) => f.kind === 'dangling'), false)
  const txt = renderDoctor(userScopeWiringChecks(home))
  assert.match(txt, /⚠/)
  assert.doesNotMatch(txt, /✗ user-scope worktree/)
})

test('nvm-pinned symlink → warn', () => {
  const home = mkTmp('sage-usw-')
  seedClaude(home)
  const targetDir = path.join(home, '.nvm', 'versions', 'node', 'v22.12.0', 'lib', 'node_modules', 'agentic-sage', 'hooks')
  fs.mkdirSync(targetDir, { recursive: true })
  const target = path.join(targetDir, 'sage-emit.mjs')
  fs.writeFileSync(target, '// ok\n')
  const link = path.join(home, '.claude', 'hooks', 'sage-emit.mjs')
  fs.symlinkSync(target, link)
  const { findings } = inspectUserScopeWiring(home)
  const n = findings.find((f) => f.kind === 'nvm-pinned')
  assert.ok(n)
  assert.equal(n.severity, 'warn')
})

test('wired-but-missing settings command → broken', () => {
  const home = mkTmp('sage-usw-')
  const claude = seedClaude(home)
  const missing = path.join(home, '.claude', 'hooks', 'missing-emit.mjs')
  const settings = {
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: `"${process.execPath}" "${missing}"` }] }],
    },
  }
  fs.writeFileSync(path.join(claude, 'settings.json'), JSON.stringify(settings))
  const { findings } = inspectUserScopeWiring(home)
  const m = findings.find((f) => f.kind === 'wired-missing')
  assert.ok(m)
  assert.equal(m.severity, 'broken')
  assert.match(m.detail, /wired-but-missing/)
})

test('dangling wins over worktree label when target is gone', () => {
  const home = mkTmp('sage-usw-')
  seedClaude(home)
  const gone = path.join(home, 'repo', '.claude', 'worktrees', 'dead', 'hooks', 'emit.mjs')
  const link = path.join(home, '.claude', 'hooks', 'agentic-sage-emit.mjs')
  fs.symlinkSync(gone, link)
  const { findings } = inspectUserScopeWiring(home)
  assert.ok(findings.some((f) => f.kind === 'dangling'))
  assert.equal(
    findings.some((f) => f.kind === 'worktree' && f.path === link),
    false,
    'must not also print worktree for the same dangling link',
  )
})

test('doctor integrates user-scope rows without throwing', () => {
  const home = mkTmp('sage-usw-')
  seedClaude(home)
  const link = path.join(home, '.claude', 'hooks', 'agentic-sage-emit.mjs')
  fs.symlinkSync(path.join(home, 'nope.mjs'), link)
  const checks = doctor(home, mkTmp('sage-norepo-'))
  assert.ok(checks.some((c) => c.name.startsWith('user-scope')))
  assert.match(renderDoctor(checks), /dangling|user-scope/)
})

test('stabilizePackageRoot strips .claude/worktrees when main has emitter', () => {
  const main = mkTmp('sage-pkg-')
  fs.mkdirSync(path.join(main, 'hooks'), { recursive: true })
  fs.writeFileSync(path.join(main, 'hooks', 'agentic-sage-emit.mjs'), 'export {}\n')
  const wt = path.join(main, '.claude', 'worktrees', 'feat')
  fs.mkdirSync(path.join(wt, 'hooks'), { recursive: true })
  fs.writeFileSync(path.join(wt, 'hooks', 'agentic-sage-emit.mjs'), 'export {}\n')
  assert.equal(stabilizePackageRoot(wt), main)
})

test('wireAll from worktree-shaped package root links main emitter', () => {
  // Build a synthetic main + worktree layout with hooks/skills, then wire
  // using the worktree path as repoRoot — symlink must land on main.
  const main = mkTmp('sage-wire-main-')
  for (const root of [main]) {
    fs.mkdirSync(path.join(root, 'hooks'), { recursive: true })
    fs.writeFileSync(path.join(root, 'hooks', 'agentic-sage-emit.mjs'), '// main emit\n')
    fs.mkdirSync(path.join(root, 'skills', 'sage-fleet'), { recursive: true })
    fs.writeFileSync(path.join(root, 'skills', 'sage-fleet', 'SKILL.md'), '# fleet\n')
    fs.mkdirSync(path.join(root, 'skills', 'sage-doctor'), { recursive: true })
    fs.writeFileSync(path.join(root, 'skills', 'sage-doctor', 'SKILL.md'), '# doctor\n')
    fs.mkdirSync(path.join(root, 'skills', 'sage-judge'), { recursive: true })
    fs.writeFileSync(path.join(root, 'skills', 'sage-judge', 'SKILL.md'), '# judge\n')
    fs.mkdirSync(path.join(root, 'bin'), { recursive: true })
    fs.writeFileSync(path.join(root, 'bin', 'sage'), '#!/usr/bin/env node\n')
  }
  const wt = path.join(main, '.claude', 'worktrees', 'integration')
  fs.mkdirSync(path.join(wt, 'hooks'), { recursive: true })
  fs.writeFileSync(path.join(wt, 'hooks', 'agentic-sage-emit.mjs'), '// wt emit\n')
  fs.mkdirSync(path.join(wt, 'skills', 'sage-fleet'), { recursive: true })
  fs.mkdirSync(path.join(wt, 'bin'), { recursive: true })
  fs.writeFileSync(path.join(wt, 'bin', 'sage'), '#!/usr/bin/env node\n')

  const home = mkTmp('sage-wire-home-')
  const result = wireAll({ home, repoRoot: wt, skipSkill: false })
  assert.equal(result.target, path.join(main, 'hooks', 'agentic-sage-emit.mjs'))
  assert.equal(fs.readlinkSync(result.link), path.join(main, 'hooks', 'agentic-sage-emit.mjs'))
  assert.ok(!isWorktreePath(result.target))
})

test('clean user-scope tree reports ok', () => {
  const home = mkTmp('sage-usw-')
  seedClaude(home)
  const target = path.join(home, 'stable', 'hooks', 'agentic-sage-emit.mjs')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, '// ok\n')
  fs.symlinkSync(target, path.join(home, '.claude', 'hooks', 'agentic-sage-emit.mjs'))
  const rows = userScopeWiringChecks(home)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].ok, true)
  assert.equal(rows[0].detail, 'clean')
})
