import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  explainRepoDataDir,
  resolveRepoDataDir,
  registryPath,
  writeRegistryEntry,
  sageHome,
  legacySageHome,
  migrateStateDir,
} from '../lib/roots.mjs'
import { resolveRepoRoot } from '../lib/repo-id.mjs'
import { mkTmp, mkGitRepo, git, writeGlobalConfig, writeLegacyGlobalConfig } from './helpers.mjs'

test('default: no env, no marker, no registry, no defaultRoot ⇒ built-in', () => {
  const home = mkTmp('sage-h-')
  const { dir, rule, scope } = explainRepoDataDir({ home, repoId: 'r' })
  assert.ok(dir.endsWith('/.claude/agentic-sage/repos/r'))
  assert.equal(rule, 'built-in')
  assert.equal(scope, 'global')
})

test('env.SAGE_STORAGE_ROOT wins first', () => {
  const home = mkTmp('sage-h-')
  const root = mkTmp('sage-root-')
  const { dir, rule } = explainRepoDataDir({ home, repoId: 'r', env: { SAGE_STORAGE_ROOT: root } })
  assert.equal(dir, path.join(root, 'repos', 'r'))
  assert.equal(rule, 'env')
})

test('marker without storageRoot ⇒ repo-root mode, dir is the marker dir itself', () => {
  const home = mkTmp('sage-h-')
  const mainRoot = mkTmp('sage-main-')
  const markerDir = path.join(mainRoot, '.agentic-sage')
  fs.mkdirSync(markerDir, { recursive: true })
  fs.writeFileSync(path.join(markerDir, 'config.json'), JSON.stringify({}))
  const { dir, rule, scope } = explainRepoDataDir({ home, mainRoot, repoId: 'r' })
  assert.equal(dir, markerDir)
  assert.equal(rule, 'marker')
  assert.equal(scope, 'project')
})

test('marker with storageRoot ~/custom ⇒ <home>/custom/repos/<id>', () => {
  const home = mkTmp('sage-h-')
  const mainRoot = mkTmp('sage-main-')
  const markerDir = path.join(mainRoot, '.agentic-sage')
  fs.mkdirSync(markerDir, { recursive: true })
  fs.writeFileSync(path.join(markerDir, 'config.json'), JSON.stringify({ storageRoot: '~/custom' }))
  const { dir } = explainRepoDataDir({ home, mainRoot, repoId: 'r' })
  assert.equal(dir, path.join(home, 'custom', 'repos', 'r'))
})

test('registry entry resolves by id alone (no mainRoot needed)', () => {
  const home = mkTmp('sage-h-')
  const dataDir = mkTmp('sage-data-')
  writeRegistryEntry(home, 'r', { dataDir, scope: 'project', mainRoot: '/some/root' })
  const { dir, rule } = explainRepoDataDir({ home, repoId: 'r' })
  assert.equal(dir, dataDir)
  assert.equal(rule, 'registry')
})

test('global config defaultRoot', () => {
  const home = mkTmp('sage-h-')
  const defaultRoot = mkTmp('sage-default-')
  writeGlobalConfig(home, { enabled: false, defaultRoot })
  const { dir, rule } = explainRepoDataDir({ home, repoId: 'r' })
  assert.equal(dir, path.join(defaultRoot, 'repos', 'r'))
  assert.equal(rule, 'default-root')
})

test('precedence: env beats marker beats registry beats defaultRoot', () => {
  const home = mkTmp('sage-h-')
  const mainRoot = mkTmp('sage-main-')
  const markerDir = path.join(mainRoot, '.agentic-sage')
  fs.mkdirSync(markerDir, { recursive: true })
  fs.writeFileSync(path.join(markerDir, 'config.json'), JSON.stringify({}))
  writeRegistryEntry(home, 'r', { dataDir: mkTmp('sage-reg-'), scope: 'project' })
  writeGlobalConfig(home, { enabled: false, defaultRoot: mkTmp('sage-default-') })

  // marker beats registry + defaultRoot.
  const withMarker = explainRepoDataDir({ home, mainRoot, repoId: 'r' })
  assert.equal(withMarker.rule, 'marker')

  // registry beats defaultRoot when there's no mainRoot (marker unreachable).
  const idOnly = explainRepoDataDir({ home, repoId: 'r' })
  assert.equal(idOnly.rule, 'registry')

  // env beats everything.
  const envRoot = mkTmp('sage-env-')
  const withEnv = explainRepoDataDir({
    home,
    mainRoot,
    repoId: 'r',
    env: { SAGE_STORAGE_ROOT: envRoot },
  })
  assert.equal(withEnv.rule, 'env')
})

test('corrupt registry JSON fails open to the next rule', () => {
  const home = mkTmp('sage-h-')
  const rp = registryPath(home)
  fs.mkdirSync(path.dirname(rp), { recursive: true })
  fs.writeFileSync(rp, '{ not valid json')
  const defaultRoot = mkTmp('sage-default-')
  writeGlobalConfig(home, { enabled: false, defaultRoot })
  const { dir, rule } = explainRepoDataDir({ home, repoId: 'r' })
  assert.equal(rule, 'default-root')
  assert.equal(dir, path.join(defaultRoot, 'repos', 'r'))
})

test('worktree stability: a linked worktree resolves to the same main root', () => {
  const main = mkGitRepo()
  const wt = path.join(mkTmp('sage-wtp-'), 'wt')
  git(main, 'worktree', 'add', '-q', wt, '-b', 'wt')
  assert.equal(resolveRepoRoot(wt), resolveRepoRoot(main))
})

test('resolveRepoDataDir returns just the dir', () => {
  const home = mkTmp('sage-h-')
  assert.equal(
    resolveRepoDataDir({ home, repoId: 'r' }),
    path.join(home, '.claude', 'agentic-sage', 'repos', 'r'),
  )
})

// ── legacy fallback + migration (plan 011) ──────────────────────────────────

test('legacy fallback: built-in repos/<id> absent, legacy repos/<id> present ⇒ rule "legacy"', () => {
  const home = mkTmp('sage-h-')
  const legacyRepoDir = path.join(legacySageHome(home), 'repos', 'r')
  fs.mkdirSync(legacyRepoDir, { recursive: true })
  const { dir, rule, scope } = explainRepoDataDir({ home, repoId: 'r' })
  assert.equal(dir, legacyRepoDir)
  assert.equal(rule, 'legacy')
  assert.equal(scope, 'global')
})

test('legacy fallback: new-dir presence beats legacy even when legacy also exists', () => {
  const home = mkTmp('sage-h-')
  fs.mkdirSync(path.join(legacySageHome(home), 'repos', 'r'), { recursive: true })
  const newRepoDir = path.join(sageHome(home), 'repos', 'r')
  fs.mkdirSync(newRepoDir, { recursive: true })
  const { dir, rule } = explainRepoDataDir({ home, repoId: 'r' })
  assert.equal(dir, newRepoDir)
  assert.equal(rule, 'built-in')
})

test('legacy fallback: neither dir exists ⇒ built-in (no legacy dir created)', () => {
  const home = mkTmp('sage-h-')
  const { dir, rule } = explainRepoDataDir({ home, repoId: 'r' })
  assert.equal(dir, path.join(sageHome(home), 'repos', 'r'))
  assert.equal(rule, 'built-in')
  assert.equal(fs.existsSync(legacySageHome(home)), false)
})

test('global config resolution: legacy-only config is read (defaultRoot honored) without migrating', () => {
  const home = mkTmp('sage-h-')
  const defaultRoot = mkTmp('sage-default-')
  writeLegacyGlobalConfig(home, { enabled: true, defaultRoot })
  const { dir, rule } = explainRepoDataDir({ home, repoId: 'r' })
  assert.equal(dir, path.join(defaultRoot, 'repos', 'r'))
  assert.equal(rule, 'default-root')
  // read-only: no migration happened as a side effect of resolving.
  assert.equal(fs.existsSync(sageHome(home)), false)
  assert.equal(fs.existsSync(legacySageHome(home)), true)
})

test('global config resolution: new config wins over legacy when both present', () => {
  const home = mkTmp('sage-h-')
  const legacyRoot = mkTmp('sage-legacy-root-')
  const newRoot = mkTmp('sage-new-root-')
  writeLegacyGlobalConfig(home, { enabled: true, defaultRoot: legacyRoot })
  writeGlobalConfig(home, { enabled: true, defaultRoot: newRoot })
  const { dir } = explainRepoDataDir({ home, repoId: 'r' })
  assert.equal(dir, path.join(newRoot, 'repos', 'r'))
})

test('migrateStateDir: legacy exists, new absent ⇒ renames legacy → new, returns "renamed"', () => {
  const home = mkTmp('sage-h-')
  fs.mkdirSync(path.join(legacySageHome(home), 'repos', 'r'), { recursive: true })
  fs.writeFileSync(path.join(legacySageHome(home), 'config.json'), JSON.stringify({ enabled: true }))
  const result = migrateStateDir(home)
  assert.equal(result, 'renamed')
  assert.equal(fs.existsSync(legacySageHome(home)), false)
  assert.equal(fs.existsSync(path.join(sageHome(home), 'repos', 'r')), true)
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(sageHome(home), 'config.json'), 'utf8')),
    { enabled: true },
  )
})

test('migrateStateDir: both exist ⇒ "both-warn", neither dir is touched (never merges)', () => {
  const home = mkTmp('sage-h-')
  fs.mkdirSync(path.join(legacySageHome(home), 'repos', 'legacy-only'), { recursive: true })
  fs.mkdirSync(path.join(sageHome(home), 'repos', 'new-only'), { recursive: true })
  const result = migrateStateDir(home)
  assert.equal(result, 'both-warn')
  // both dirs intact, untouched, unmerged — legacy-only stays legacy-only.
  assert.equal(fs.existsSync(path.join(legacySageHome(home), 'repos', 'legacy-only')), true)
  assert.equal(fs.existsSync(path.join(sageHome(home), 'repos', 'new-only')), true)
  assert.equal(fs.existsSync(path.join(sageHome(home), 'repos', 'legacy-only')), false)
  assert.equal(fs.existsSync(path.join(legacySageHome(home), 'repos', 'new-only')), false)
})

test('migrateStateDir: neither exists ⇒ "noop", creates nothing', () => {
  const home = mkTmp('sage-h-')
  const result = migrateStateDir(home)
  assert.equal(result, 'noop')
  assert.equal(fs.existsSync(sageHome(home)), false)
  assert.equal(fs.existsSync(legacySageHome(home)), false)
})

test('migrateStateDir: new-only (already migrated) ⇒ "noop", left alone', () => {
  const home = mkTmp('sage-h-')
  fs.mkdirSync(path.join(sageHome(home), 'repos', 'r'), { recursive: true })
  const result = migrateStateDir(home)
  assert.equal(result, 'noop')
  assert.equal(fs.existsSync(path.join(sageHome(home), 'repos', 'r')), true)
})
