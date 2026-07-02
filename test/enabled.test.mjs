import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { isEnabled } from '../lib/enabled.mjs'
import { repoConfig } from '../lib/paths.mjs'
import { mkTmp, writeGlobalConfig } from './helpers.mjs'

test('default-OFF: no global config ⇒ disabled', () => {
  const home = mkTmp('sage-h-')
  assert.equal(isEnabled({ home, repoId: 'r', cwd: home, env: {} }), false)
})

test('global {enabled:true}, no overrides ⇒ enabled', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  assert.equal(isEnabled({ home, repoId: 'r', cwd: home, env: {} }), true)
})

test('per-repo {enabled:false} ⇒ disabled', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const rc = repoConfig(home, 'r')
  fs.mkdirSync(path.dirname(rc), { recursive: true })
  fs.writeFileSync(rc, JSON.stringify({ enabled: false }))
  assert.equal(isEnabled({ home, repoId: 'r', cwd: home, env: {} }), false)
})

test('SAGE_OPT_OUT=1 ⇒ disabled', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  assert.equal(isEnabled({ home, repoId: 'r', cwd: home, env: { SAGE_OPT_OUT: '1' } }), false)
})

test('.sage-ignore in cwd ⇒ disabled', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const cwd = mkTmp('sage-cwd-')
  fs.writeFileSync(path.join(cwd, '.sage-ignore'), '')
  assert.equal(isEnabled({ home, repoId: 'r', cwd, env: {} }), false)
})

// ---- scope: 'project' (enable model v2) ----

test('project scope: no global config ⇒ enabled (init on a project implies opt-in)', () => {
  const home = mkTmp('sage-h-') // no global config at all
  assert.equal(isEnabled({ home, repoId: 'r', cwd: home, env: {}, scope: 'project' }), true)
})

test('project scope: per-repo {enabled:false} ⇒ disabled', () => {
  const home = mkTmp('sage-h-')
  const rc = repoConfig(home, 'r')
  fs.mkdirSync(path.dirname(rc), { recursive: true })
  fs.writeFileSync(rc, JSON.stringify({ enabled: false }))
  assert.equal(isEnabled({ home, repoId: 'r', cwd: home, env: {}, scope: 'project' }), false)
})

test('project scope: SAGE_OPT_OUT=1 ⇒ disabled (opt-out always wins)', () => {
  const home = mkTmp('sage-h-')
  assert.equal(
    isEnabled({ home, repoId: 'r', cwd: home, env: { SAGE_OPT_OUT: '1' }, scope: 'project' }),
    false,
  )
})

test('project scope: .sage-ignore in cwd ⇒ disabled', () => {
  const home = mkTmp('sage-h-')
  const cwd = mkTmp('sage-cwd-')
  fs.writeFileSync(path.join(cwd, '.sage-ignore'), '')
  assert.equal(isEnabled({ home, repoId: 'r', cwd, env: {}, scope: 'project' }), false)
})

test('no scope passed ⇒ defaults to global (default-OFF behavior unchanged)', () => {
  const home = mkTmp('sage-h-') // no global config
  assert.equal(isEnabled({ home, repoId: 'r', cwd: home, env: {} }), false)
})
