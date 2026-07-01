import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readRecord, writeRecord, mergeRecord, appendEvent } from '../lib/store.mjs'
import { eventsFile } from '../lib/paths.mjs'
import { mkTmp } from './helpers.mjs'

const pexecFile = promisify(execFile)

const STORE_URL = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'store.mjs'),
).href

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

test('concurrent mergeRecord from N processes loses no fields', async () => {
  const home = mkTmp('sage-h-')
  writeRecord(home, 'r', 's', { seed: true })
  const N = 6
  const M = 20
  const script = (w) =>
    `import { mergeRecord } from '${STORE_URL}'\n` +
    `for (let j = 0; j < ${M}; j++) mergeRecord('${home}', 'r', 's', { ['k_${w}_' + j]: 1 })\n`
  await Promise.all(
    Array.from({ length: N }, (_, w) =>
      pexecFile('node', ['--input-type=module', '-e', script(w)]),
    ),
  )
  const rec = readRecord(home, 'r', 's')
  const missing = []
  for (let w = 0; w < N; w++)
    for (let j = 0; j < M; j++) if (rec[`k_${w}_${j}`] !== 1) missing.push(`k_${w}_${j}`)
  assert.deepEqual(missing, [], `lost ${missing.length} of ${N * M} merged fields`)
  assert.equal(rec.seed, true)
})

test('concurrent appendEvent lines are all present and parseable', async () => {
  const home = mkTmp('sage-h-')
  const N = 6
  const M = 20
  const script = (w) =>
    `import { appendEvent } from '${STORE_URL}'\n` +
    `for (let j = 0; j < ${M}; j++) appendEvent('${home}', 'r', { event: 'e', w: ${w}, j })\n`
  await Promise.all(
    Array.from({ length: N }, (_, w) =>
      pexecFile('node', ['--input-type=module', '-e', script(w)]),
    ),
  )
  const lines = fs.readFileSync(eventsFile(home, 'r'), 'utf8').split('\n').filter(Boolean)
  assert.equal(lines.length, N * M)
  for (const l of lines) JSON.parse(l) // throws on a torn line
})
