import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { repoDir } from '../lib/paths.mjs'
import { adapterPathFor, loadAdapter, zoneOf, rowOf } from '../lib/adapter.mjs'

const writeAdapter = (dir, body) => {
  fs.mkdirSync(path.join(dir, '.sage'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.sage', 'adapter.mjs'), body)
}

test('adapterPathFor prefers repo .sage, then state dir, then null', () => {
  const home = mkTmp('sage-h-')
  const root = mkTmp('sage-root-')
  assert.equal(adapterPathFor(home, 'r1', root), null)
  fs.mkdirSync(repoDir(home, 'r1'), { recursive: true })
  fs.writeFileSync(path.join(repoDir(home, 'r1'), 'adapter.mjs'), 'export const ownsZone = () => null')
  assert.equal(adapterPathFor(home, 'r1', root), path.join(repoDir(home, 'r1'), 'adapter.mjs'))
  writeAdapter(root, 'export const ownsZone = () => null')
  assert.match(adapterPathFor(home, 'r1', root), /\.sage\/adapter\.mjs$/)
})

test('loadAdapter imports a real adapter; broken/missing → null', async () => {
  const home = mkTmp('sage-h-')
  // distinct roots per case — ESM import() caches by file URL, so reusing one
  // path within a process would return the first-loaded module (not a concern
  // for the real CLI, which is a fresh process per invocation).
  assert.equal(await loadAdapter(home, 'r1', mkTmp('sage-root-')), null) // none
  const good = mkTmp('sage-root-')
  writeAdapter(good, 'export const ownsZone = (p) => p === "x" ? "zx" : null')
  const a = await loadAdapter(home, 'r1', good)
  assert.equal(typeof a.ownsZone, 'function')
  assert.equal(a.ownsZone('x'), 'zx')
  const broken = mkTmp('sage-root-')
  writeAdapter(broken, 'this is not valid javascript ::::')
  assert.equal(await loadAdapter(home, 'r1', broken), null) // broken → null
})

test('zoneOf/rowOf swallow a null adapter and a throwing method', () => {
  assert.equal(zoneOf(null, {}, 'x'), null)
  assert.equal(rowOf(null, {}, {}), null)
  const bad = {
    ownsZone: () => { throw new Error('boom') },
    claimedWork: () => { throw new Error('boom') },
  }
  assert.equal(zoneOf(bad, {}, 'x'), null)
  assert.equal(rowOf(bad, {}, {}), null)
})
