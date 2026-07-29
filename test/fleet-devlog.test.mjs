// Vendored fleet-devlog tests (from work-kb reference) + drift guard.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { devlogEnabled, installId, sanitizeEvent, emit, referencePath } from '../lib/fleet-devlog.mjs'

test('off by default with no env and no config', () => {
  assert.equal(devlogEnabled({ env: {}, argv: [], config: null }), false)
})

test('machine config is the only persistent enable source', () => {
  assert.equal(devlogEnabled({ env: {}, argv: [], config: { enabled: true } }), true)
  assert.equal(devlogEnabled({ env: {}, argv: [], config: { enabled: false } }), false)
})

test('env outranks config in both directions', () => {
  assert.equal(devlogEnabled({ env: { FLEET_DEVLOG: '1' }, argv: [], config: { enabled: false } }), true)
  assert.equal(devlogEnabled({ env: { FLEET_DEVLOG: '0' }, argv: [], config: { enabled: true } }), false)
})

test('--no-devlog beats an enabling config', () => {
  assert.equal(devlogEnabled({ env: {}, argv: ['--no-devlog'], config: { enabled: true } }), false)
})

test('installId is stable across calls and shared by root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devlog-'))
  const a = installId({ root })
  const b = installId({ root })
  assert.equal(a, b)
  assert.match(a, /^[0-9a-f]{16,}$/)
})

test('sanitizeEvent drops every field not in the contract', () => {
  const out = sanitizeEvent(
    {
      v: 1, tool: 'memory-atlas', cmd: 'check', exit: 0, ms: 5,
      prompt: 'secret user text',
      path: '/home/kento/Repositories/syndcast/src/secret.ts',
      apiKey: 'sk-live-123',
      counts: { zones: 4 },
    },
    { safeFlags: [] },
  )
  assert.equal(out.prompt, undefined)
  assert.equal(out.path, undefined)
  assert.equal(out.apiKey, undefined)
  assert.deepEqual(out.counts, { zones: 4 })
  assert.equal(out.cmd, 'check')
})

test('sanitizeEvent rejects a non-numeric value inside counts', () => {
  const out = sanitizeEvent({ v: 1, tool: 'agentic-sage', cmd: 'board', counts: { zones: 4, name: 'syndcast' } }, { safeFlags: [] })
  assert.deepEqual(out.counts, { zones: 4 })
})

test('argv_shape keeps only allow-listed flags and never their values', () => {
  const out = sanitizeEvent(
    { v: 1, tool: 'memory-atlas', cmd: 'check', argv_shape: ['--strict', '--profile', 'code', '--secret-thing'] },
    { safeFlags: ['--strict', '--profile'] },
  )
  assert.deepEqual(out.argv_shape, ['--strict', '--profile'])
})

test('an unknown tool name is rejected', () => {
  assert.equal(sanitizeEvent({ v: 1, tool: 'evil-tool', cmd: 'x' }, { safeFlags: [] }), null)
})

test('emit writes nothing when disabled', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devlog-'))
  emit({ v: 1, tool: 'memory-atlas', cmd: 'check', exit: 0 }, { root, env: {}, argv: [], config: null })
  assert.equal(fs.existsSync(path.join(root, 'events.jsonl')), false)
})

test('emit appends one line when enabled', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devlog-'))
  emit({ v: 1, tool: 'memory-atlas', cmd: 'check', exit: 0 }, { root, env: { FLEET_DEVLOG: '1' }, argv: [], config: null })
  const lines = fs.readFileSync(path.join(root, 'events.jsonl'), 'utf8').trim().split('\n')
  assert.equal(lines.length, 1)
  const e = JSON.parse(lines[0])
  assert.equal(e.tool, 'memory-atlas')
  assert.ok(e.install_id)
  assert.ok(e.ts)
})

test('emit never throws on an unwritable root', () => {
  assert.doesNotThrow(() =>
    emit({ v: 1, tool: 'memory-atlas', cmd: 'check' }, {
      root: '/proc/definitely/not/writable',
      env: { FLEET_DEVLOG: '1' }, argv: [], config: null,
    }),
  )
})

test('referencePath honours FLEET_DEVLOG_REF and falls back to default', () => {
  const def = '/home/kento/Repositories/work-kb/contracts/fleet-devlog.reference.mjs'
  assert.equal(referencePath({}), def)
  assert.equal(referencePath({ FLEET_DEVLOG_REF: '/tmp/alt-ref.mjs' }), '/tmp/alt-ref.mjs')
})

test('vendored emitter matches the work-kb reference', () => {
  const ref = process.env.FLEET_DEVLOG_REF
    || '/home/kento/Repositories/work-kb/contracts/fleet-devlog.reference.mjs'
  if (!fs.existsSync(ref)) return   // stranger's clone: no work-kb, nothing to compare — skip
  const a = crypto.createHash('sha256').update(fs.readFileSync(ref)).digest('hex')
  const b = crypto.createHash('sha256').update(
    fs.readFileSync(new URL('../lib/fleet-devlog.mjs', import.meta.url))).digest('hex')
  assert.equal(b, a, 'vendored copy has drifted from the reference')
})
