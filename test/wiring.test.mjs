import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { wireAll, wireProject } from '../lib/wiring.mjs'
import { readRegistry } from '../lib/roots.mjs'
import { repoIdFromRoot } from '../lib/repo-id.mjs'
import { mkTmp, mkGitRepo, git } from './helpers.mjs'

// The real repo root — skills/ and hooks/ must exist for symlink tests.
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'PreCompact', 'SessionEnd', 'PreToolUse']

test('wireAll: returns expected result shape', () => {
  const home = mkTmp('sage-w-')
  const r = wireAll({ home, repoRoot: REPO_ROOT })
  assert.ok(r.gc.includes('sage'))
  assert.ok(r.link.includes('agentic-sage-emit.mjs'))
  assert.ok(r.target.endsWith('hooks/agentic-sage-emit.mjs'))
  assert.ok(r.settingsPath.endsWith('settings.json'))
  assert.ok(typeof r.tmuxNote === 'string')
  assert.ok(typeof r.skillNote === 'string')
  assert.ok(r.sageBin.endsWith('bin/sage'))
})

test('wireAll: seeds default-OFF config and wires all 7 hook events', () => {
  const home = mkTmp('sage-w-')
  wireAll({ home, repoRoot: REPO_ROOT })
  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'agentic-sage', 'config.json'), 'utf8'))
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
  const cfg1 = fs.readFileSync(path.join(home, '.claude', 'agentic-sage', 'config.json'), 'utf8')
  wireAll({ home, repoRoot: REPO_ROOT })
  const cfg2 = fs.readFileSync(path.join(home, '.claude', 'agentic-sage', 'config.json'), 'utf8')
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
  const link = path.join(hooksDir, 'agentic-sage-emit.mjs')
  fs.writeFileSync(link, '// original')
  wireAll({ home, repoRoot: REPO_ROOT })
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true)
  assert.equal(fs.readFileSync(link + '.bak', 'utf8'), '// original')
})

// ── plan 011: rewire a pre-rename install in place, no double-fire ─────────

test('wireAll: re-init over a pre-rename (sage-emit.mjs) install rewires in place — one hook entry per event, no stale old-name entry, old symlink removed', () => {
  const home = mkTmp('sage-w-')
  const hooksDir = path.join(home, '.claude', 'hooks')
  fs.mkdirSync(hooksDir, { recursive: true })
  // Simulate a pre-rename install: an old-named symlink pointing into this
  // repo, plus a settings.json wired against that old link path.
  const oldLink = path.join(hooksDir, 'sage-emit.mjs')
  fs.symlinkSync(path.join(REPO_ROOT, 'hooks', 'sage-emit.mjs'), oldLink)
  const claude = path.join(home, '.claude')
  fs.mkdirSync(claude, { recursive: true })
  const settingsPath = path.join(claude, 'settings.json')
  const oldCommand = `${JSON.stringify(process.execPath)} ${JSON.stringify(oldLink)}`
  const settings = { hooks: {} }
  for (const ev of EVENTS) settings.hooks[ev] = [{ hooks: [{ type: 'command', command: oldCommand }] }]
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

  wireAll({ home, repoRoot: REPO_ROOT })

  const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  for (const ev of EVENTS) {
    const cmds = after.hooks[ev].flatMap((g) => g.hooks.map((h) => h.command))
    assert.equal(cmds.length, 1, `expected exactly one hook for ${ev}, got ${cmds.length}`)
    assert.ok(cmds[0].includes('agentic-sage-emit.mjs'))
    assert.ok(!cmds.some((c) => c === oldCommand))
  }
  // the stale old-named symlink (ours) was removed
  assert.equal(fs.existsSync(oldLink), false)
  // the new-named symlink is in place
  const newLink = path.join(hooksDir, 'agentic-sage-emit.mjs')
  assert.equal(fs.lstatSync(newLink).isSymbolicLink(), true)
})

test('wireAll: rewire never touches a FOREIGN hook that merely mentions the sage-emit token', () => {
  const home = mkTmp('sage-w-')
  const hooksDir = path.join(home, '.claude', 'hooks')
  fs.mkdirSync(hooksDir, { recursive: true })
  const claude = path.join(home, '.claude')
  fs.mkdirSync(claude, { recursive: true })
  const settingsPath = path.join(claude, 'settings.json')
  const foreignCommand = 'echo this mentions sage-emit.mjs but is not our hook'
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      hooks: { Stop: [{ hooks: [{ type: 'command', command: foreignCommand }] }] },
    }),
  )

  wireAll({ home, repoRoot: REPO_ROOT })

  const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  const cmds = after.hooks.Stop.flatMap((g) => g.hooks.map((h) => h.command))
  assert.ok(cmds.includes(foreignCommand)) // foreign hook survives untouched
  assert.equal(cmds.length, 2) // foreign + our new one
})

// ── wireProject: project-scope install (plan 009) ──────────────────────────

test('wireProject: wires all 7 events into <project>/.claude/settings.json with --scope=project, and never touches <home>/.claude/settings.json', () => {
  const home = mkTmp('sage-w-')
  const project = mkGitRepo()
  wireProject({ home, repoRoot: REPO_ROOT, projectRoot: project })

  const settings = JSON.parse(
    fs.readFileSync(path.join(project, '.claude', 'settings.json'), 'utf8'),
  )
  for (const ev of EVENTS) {
    assert.ok((settings.hooks[ev] || []).length >= 1, `missing ${ev}`)
    for (const grp of settings.hooks[ev]) {
      for (const h of grp.hooks) assert.match(h.command, / --scope=project$/)
    }
  }
  assert.equal(fs.existsSync(path.join(home, '.claude', 'settings.json')), false)
})

test('wireProject: repo-root preset writes a marker with no storageRoot, registry dataDir is the marker dir', () => {
  const home = mkTmp('sage-w-')
  const project = mkGitRepo()
  const result = wireProject({ home, repoRoot: REPO_ROOT, projectRoot: project, storage: 'repo-root' })

  const markerPath = path.join(project, '.agentic-sage', 'config.json')
  assert.equal(result.markerPath, markerPath)
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
  assert.equal('storageRoot' in marker, false)

  const registry = readRegistry(home)
  const repoId = repoIdFromRoot(project)
  assert.equal(registry.repos[repoId].scope, 'project')
  assert.equal(registry.repos[repoId].dataDir, path.join(project, '.agentic-sage'))
  assert.equal(result.dataDir, path.join(project, '.agentic-sage'))
})

test('wireProject: sibling preset points the marker + registry at a hidden root beside the repo', () => {
  const home = mkTmp('sage-w-')
  const project = mkGitRepo()
  const result = wireProject({ home, repoRoot: REPO_ROOT, projectRoot: project, storage: 'sibling' })

  const siblingRoot = path.join(path.dirname(project), '.agentic-sage')
  const marker = JSON.parse(
    fs.readFileSync(path.join(project, '.agentic-sage', 'config.json'), 'utf8'),
  )
  assert.equal(marker.storageRoot, siblingRoot)

  const repoId = repoIdFromRoot(project)
  const expectedDataDir = path.join(siblingRoot, 'repos', repoId)
  assert.equal(result.dataDir, expectedDataDir)
  const registry = readRegistry(home)
  assert.equal(registry.repos[repoId].dataDir, expectedDataDir)
})

test('wireProject: idempotent — second run adds no duplicate hook group and does not rewrite an unchanged marker', () => {
  const home = mkTmp('sage-w-')
  const project = mkGitRepo()
  wireProject({ home, repoRoot: REPO_ROOT, projectRoot: project })

  const markerPath = path.join(project, '.agentic-sage', 'config.json')
  const before = fs.statSync(markerPath)

  wireProject({ home, repoRoot: REPO_ROOT, projectRoot: project })

  const settings = JSON.parse(
    fs.readFileSync(path.join(project, '.claude', 'settings.json'), 'utf8'),
  )
  assert.equal(settings.hooks.Stop.length, 1)

  const after = fs.statSync(markerPath)
  assert.equal(after.mtimeMs, before.mtimeMs)
})

test('wireProject: malformed project settings.json throws ABORTED, file intact, no marker/registry written', () => {
  const home = mkTmp('sage-w-')
  const project = mkGitRepo()
  const claude = path.join(project, '.claude')
  fs.mkdirSync(claude, { recursive: true })
  const sp = path.join(claude, 'settings.json')
  fs.writeFileSync(sp, '{ bad json,, }')

  assert.throws(() => wireProject({ home, repoRoot: REPO_ROOT, projectRoot: project }), /ABORTED/)
  assert.equal(fs.readFileSync(sp, 'utf8'), '{ bad json,, }')
  assert.equal(fs.existsSync(path.join(project, '.agentic-sage')), false)

  const repoId = repoIdFromRoot(project)
  const registry = readRegistry(home)
  assert.equal(registry.repos[repoId], undefined)
})

test('wireProject: worktree safety — a project install pointed at a linked worktree writes the marker to the MAIN root only', () => {
  const home = mkTmp('sage-w-')
  const main = mkGitRepo()
  const wt = path.join(mkTmp('sage-wtp-'), 'wt')
  git(main, 'worktree', 'add', '-q', wt, '-b', 'wt')

  const result = wireProject({ home, repoRoot: REPO_ROOT, projectRoot: wt })

  assert.equal(result.mainRoot, main)
  assert.equal(fs.existsSync(path.join(wt, '.agentic-sage')), false)
  assert.equal(fs.existsSync(path.join(main, '.agentic-sage', 'config.json')), true)
})

test('wireAll: global-scope install with a custom storage root merges defaultRoot without dropping enabled', () => {
  const home = mkTmp('sage-w-')
  wireAll({ home, repoRoot: REPO_ROOT }) // seeds {enabled:false} first, as a real install would
  const storageRoot = mkTmp('sage-custom-root-')
  wireAll({ home, repoRoot: REPO_ROOT, storageRoot })

  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'agentic-sage', 'config.json'), 'utf8'))
  assert.equal(cfg.enabled, false)
  assert.equal(cfg.defaultRoot, storageRoot)
})

// ── grok native wiring (plan 014) ──────────────────────────────────────────

test('wireAll grok: writes native hooks/agentic-sage.json with all 7 events', () => {
  const home = mkTmp('sage-w-')
  wireAll({ home, repoRoot: REPO_ROOT, harness: 'grok' })
  const hookFile = path.join(home, '.grok', 'hooks', 'agentic-sage.json')
  const cfg = JSON.parse(fs.readFileSync(hookFile, 'utf8'))
  const events = Object.keys(cfg.hooks)
  for (const ev of ['SessionStart','UserPromptSubmit','PostToolUse','Stop','PreCompact','SessionEnd','PreToolUse']) {
    assert.ok(events.includes(ev), `missing ${ev}`)
    const cmd = cfg.hooks[ev][0].hooks[0].command
    assert.match(cmd, /agentic-sage-emit\.mjs/)
  }
  // emitter reachable at the path the command references
  const emitterRef = cfg.hooks.SessionStart[0].hooks[0].command.replace(/^node\s+/, '')
  assert.ok(fs.existsSync(emitterRef), 'emitter symlink exists at referenced path')
  // config.toml untouched
  assert.ok(!fs.existsSync(path.join(home, '.grok', 'config.toml')))
})

test('wireAll grok: idempotent — second run leaves an identical file', () => {
  const home = mkTmp('sage-w-')
  wireAll({ home, repoRoot: REPO_ROOT, harness: 'grok' })
  const hookFile = path.join(home, '.grok', 'hooks', 'agentic-sage.json')
  const first = fs.readFileSync(hookFile, 'utf8')
  wireAll({ home, repoRoot: REPO_ROOT, harness: 'grok' })
  assert.equal(fs.readFileSync(hookFile, 'utf8'), first)
})
