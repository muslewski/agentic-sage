import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { sessionsDir, globalConfig, sageHome } from '../lib/paths.mjs'
import { readRecord } from '../lib/store.mjs'
import {
  setEnabled,
  readEnabled,
  linkSession,
  unlinkSession,
  listRepos,
  doctor,
  renderDoctor,
} from '../lib/control.mjs'

test('setEnabled/readEnabled roundtrip + creates dir', () => {
  const home = mkTmp('sage-c-')
  setEnabled(home, true)
  assert.equal(readEnabled(home), true)
  assert.deepEqual(JSON.parse(fs.readFileSync(globalConfig(home), 'utf8')), { enabled: true })
  setEnabled(home, false)
  assert.equal(readEnabled(home), false)
})

test('linkSession/unlinkSession set link_state', () => {
  const home = mkTmp('sage-c-')
  linkSession(home, 'repo-x', 's1', 'linked')
  assert.equal(readRecord(home, 'repo-x', 's1').link_state, 'linked')
  unlinkSession(home, 'repo-x', 's1')
  assert.equal(readRecord(home, 'repo-x', 's1').link_state, 'closed')
})

test('listRepos counts sessions; empty → []', () => {
  const home = mkTmp('sage-c-')
  assert.deepEqual(listRepos(home), [])
  fs.mkdirSync(sessionsDir(home, 'repo-a'), { recursive: true })
  fs.writeFileSync(path.join(sessionsDir(home, 'repo-a'), 's1.json'), '{}')
  fs.writeFileSync(path.join(sessionsDir(home, 'repo-a'), 's2.json'), '{}')
  const repos = listRepos(home)
  assert.equal(repos.find((r) => r.repoId === 'repo-a').sessions, 2)
})

test('doctor reports checks without throwing; hook absent → not ok', () => {
  const home = mkTmp('sage-c-')
  setEnabled(home, true)
  const checks = doctor(home, mkTmp('sage-norepo-'))
  const byName = Object.fromEntries(checks.map((c) => [c.name, c]))
  assert.equal(byName['global config'].ok, true)
  assert.equal(byName['emitter hook'].ok, false)
  assert.match(renderDoctor(checks), /global config/)
})

// --- P8: token-forecast doctor check is config-driven (portable) ---

const writeConfig = (home, cfg) => {
  fs.mkdirSync(sageHome(home), { recursive: true })
  fs.writeFileSync(globalConfig(home), JSON.stringify(cfg))
}
const tfCheck = (home) => doctor(home, mkTmp('sage-norepo-')).find((c) => c.name === 'token-forecast')

test('token-forecast: configured + present ⇒ ok', () => {
  const home = mkTmp('sage-tf-')
  const tf = path.join(home, 'tf')
  fs.mkdirSync(tf, { recursive: true })
  writeConfig(home, { enabled: false, tokenForecastPath: tf })
  const c = tfCheck(home)
  assert.equal(c.ok, true)
  assert.match(c.detail, /present/)
})

test('token-forecast: configured + absent ⇒ not ok', () => {
  const home = mkTmp('sage-tf-')
  writeConfig(home, { enabled: false, tokenForecastPath: path.join(home, 'nope') })
  const c = tfCheck(home)
  assert.equal(c.ok, false)
  assert.match(c.detail, /absent/)
})

test('token-forecast: unset ⇒ not configured (optional), no hardcoded path', () => {
  const home = mkTmp('sage-tf-')
  writeConfig(home, { enabled: false })
  const c = tfCheck(home)
  assert.equal(c.ok, true)
  assert.match(c.detail, /not configured/)
})

test('token-forecast: ~ expands under HOME', () => {
  const home = mkTmp('sage-tf-')
  fs.mkdirSync(path.join(home, 'tfx'), { recursive: true })
  writeConfig(home, { enabled: false, tokenForecastPath: '~/tfx' })
  const c = tfCheck(home)
  assert.equal(c.ok, true)
  assert.match(c.detail, /present/)
})

test('setEnabled merges — preserves tokenForecastPath across on/off', () => {
  const home = mkTmp('sage-tf-')
  writeConfig(home, { enabled: false, tokenForecastPath: '~/tfx' })
  setEnabled(home, true)
  const cfg = JSON.parse(fs.readFileSync(globalConfig(home), 'utf8'))
  assert.equal(cfg.enabled, true)
  assert.equal(cfg.tokenForecastPath, '~/tfx')
})
