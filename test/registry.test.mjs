import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pidForSession } from '../lib/registry.mjs'
import { mkTmp } from './helpers.mjs'

test('pidForSession finds the pid whose registry entry matches', () => {
  const home = mkTmp('sage-h-')
  const dir = path.join(home, '.claude', 'sessions')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '123.json'), JSON.stringify({ sessionId: 'abc', pid: 123 }))
  fs.writeFileSync(path.join(dir, '456.json'), JSON.stringify({ sessionId: 'def', pid: 456 }))
  assert.equal(pidForSession(home, 'abc'), 123)
  assert.equal(pidForSession(home, 'def'), 456)
})

test('unknown session ⇒ null; no registry dir ⇒ null', () => {
  const home = mkTmp('sage-h-')
  assert.equal(pidForSession(home, 'missing'), null)
})
