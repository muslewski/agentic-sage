import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { askingDir, askingFile, markAsking, askingAgeMs, clearAsking } from '../lib/asking.mjs'

test('markAsking writes a fresh breadcrumb; askingAgeMs is small then Infinity', () => {
  const home = mkTmp('sage-h-')
  assert.equal(askingAgeMs(home, 's1', Date.now()), Infinity) // absent
  markAsking(home, 's1', 'territory')
  assert.equal(fs.readFileSync(askingFile(home, 's1'), 'utf8').trim(), 'territory')
  assert.ok(askingAgeMs(home, 's1', Date.now()) < 2000) // just written
  clearAsking(home, 's1')
  assert.equal(fs.existsSync(askingFile(home, 's1')), false)
  assert.equal(askingAgeMs(home, 's1', Date.now()), Infinity)
})

test('a stale mtime yields a large age', () => {
  const home = mkTmp('sage-h-')
  markAsking(home, 's1', 'fleet')
  const old = new Date(Date.now() - 60_000)
  fs.utimesSync(askingFile(home, 's1'), old, old)
  assert.ok(askingAgeMs(home, 's1', Date.now()) >= 60_000)
})

test('a sid with separators or dots cannot escape the asking dir', () => {
  const home = mkTmp('sage-h-')
  markAsking(home, '../../etc/passwd', 'x')
  assert.equal(path.dirname(askingFile(home, '../../etc/passwd')), askingDir(home)) // flat, no escape
  assert.equal(fs.existsSync(path.join(home, 'etc', 'passwd')), false)
})
