import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { sessionsDir, globalConfig } from '../lib/paths.mjs'
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
