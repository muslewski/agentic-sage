import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  explainRepoDataDir,
  resolveRepoDataDir,
  registryPath,
  writeRegistryEntry,
} from '../lib/roots.mjs'
import { resolveRepoRoot } from '../lib/repo-id.mjs'
import { mkTmp, mkGitRepo, git, writeGlobalConfig } from './helpers.mjs'

test('default: no env, no marker, no registry, no defaultRoot ⇒ built-in', () => {
  const home = mkTmp('sage-h-')
  const { dir, rule, scope } = explainRepoDataDir({ home, repoId: 'r' })
  assert.ok(dir.endsWith('/.claude/sage/repos/r'))
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
  assert.equal(resolveRepoDataDir({ home, repoId: 'r' }), path.join(home, '.claude', 'sage', 'repos', 'r'))
})
