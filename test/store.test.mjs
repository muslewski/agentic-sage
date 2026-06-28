import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { readRecord, writeRecord, mergeRecord, appendEvent } from '../lib/store.mjs'
import { eventsFile } from '../lib/paths.mjs'
import { mkTmp } from './helpers.mjs'

test('writeRecord → readRecord round-trips', () => {
  const home = mkTmp('sage-h-')
  writeRecord(home, 'r', 's', { a: 1, b: 'x' })
  assert.deepEqual(readRecord(home, 'r', 's'), { a: 1, b: 'x' })
})

test('readRecord on a missing file ⇒ null', () => {
  const home = mkTmp('sage-h-')
  assert.equal(readRecord(home, 'r', 'nope'), null)
})

test('mergeRecord preserves prior keys and adds new ones', () => {
  const home = mkTmp('sage-h-')
  writeRecord(home, 'r', 's', { a: 1, keep: true })
  const out = mergeRecord(home, 'r', 's', { a: 2, added: 'y' })
  assert.deepEqual(out, { a: 2, keep: true, added: 'y' })
  assert.deepEqual(readRecord(home, 'r', 's'), { a: 2, keep: true, added: 'y' })
})

test('appendEvent yields one NDJSON line per call', () => {
  const home = mkTmp('sage-h-')
  appendEvent(home, 'r', { event: 'open' })
  appendEvent(home, 'r', { event: 'stop' })
  const lines = fs.readFileSync(eventsFile(home, 'r'), 'utf8').split('\n').filter(Boolean)
  assert.equal(lines.length, 2)
  assert.equal(JSON.parse(lines[1]).event, 'stop')
})
