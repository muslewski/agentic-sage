import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { ensurePredevAtlasGate } from '../scripts/fleet-wire-desk.mjs'

test('ensurePredevAtlasGate sets predev when missing', () => {
  const repo = mkTmp('fw-predev-')
  fs.writeFileSync(
    path.join(repo, 'package.json'),
    JSON.stringify({ name: 't', scripts: {} }, null, 2),
  )
  const r = ensurePredevAtlasGate([repo], { dry: false })
  assert.equal(r.wrote, 1)
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts.predev, 'atlas gate')
  assert.equal(pkg.scripts['atlas:gate'], 'atlas gate')
})

test('ensurePredevAtlasGate prepends when predev exists without atlas', () => {
  const repo = mkTmp('fw-predev2-')
  fs.writeFileSync(
    path.join(repo, 'package.json'),
    JSON.stringify({ name: 't', scripts: { predev: 'echo hi' } }, null, 2),
  )
  const r = ensurePredevAtlasGate([repo], { dry: false })
  assert.equal(r.wrote, 1)
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts.predev, 'atlas gate && echo hi')
})

test('ensurePredevAtlasGate skips when atlas gate already present', () => {
  const repo = mkTmp('fw-predev3-')
  fs.writeFileSync(
    path.join(repo, 'package.json'),
    JSON.stringify({ name: 't', scripts: { predev: 'atlas gate' } }, null, 2),
  )
  const r = ensurePredevAtlasGate([repo], { dry: false })
  assert.equal(r.skipped, 1)
  assert.equal(r.wrote, 0)
})
