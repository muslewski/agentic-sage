// test/register.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { registerSession, heartbeatSession, closeSession } from '../lib/register.mjs'
import { readRecord } from '../lib/store.mjs'

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sage-reg-'))

test('registerSession writes a session record with launcher provenance', () => {
  const home = tmpHome()
  const r = registerSession({
    home,
    sid: 'child-001',
    pid: 4242,
    cwd: process.cwd(),
    kind: 'grok',
    by: 'llm-armory',
    lane: 'armory',
    parent: 'queen-01',
    now: Date.parse('2026-07-29T12:00:00.000Z'),
  })
  assert.equal(r.ok, true)
  assert.equal(r.sid, 'child-001')
  const rec = readRecord(home, r.repo_id, 'child-001')
  assert.equal(rec.pid, 4242)
  assert.equal(rec.agent_kind, 'grok')
  assert.equal(rec.registered_by, 'llm-armory')
  assert.equal(rec.managed_by, 'nested')
  assert.equal(rec.parent_sid, 'queen-01')
  assert.equal(rec.lane, 'armory')
  assert.equal(rec.status, 'active')
  assert.equal(rec.opened_at, '2026-07-29T12:00:00.000Z')
})

test('registerSession soft-fails outside a git repo without throwing', () => {
  const home = tmpHome()
  const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'))
  const r = registerSession({ home, sid: 'x', cwd: notRepo })
  assert.equal(r.ok, false)
  assert.match(r.reason, /repo/i)
})

test('registerSession requires a sid', () => {
  assert.throws(() => registerSession({ home: tmpHome(), cwd: process.cwd() }), /sid/i)
})

test('heartbeatSession bumps updated_at without clobbering opened_at', () => {
  const home = tmpHome()
  const t0 = Date.parse('2026-07-29T12:00:00.000Z')
  const r = registerSession({ home, sid: 's1', pid: 1, cwd: process.cwd(), now: t0 })
  heartbeatSession({ home, sid: 's1', cwd: process.cwd(), now: t0 + 60_000 })
  const rec = readRecord(home, r.repo_id, 's1')
  assert.equal(rec.opened_at, '2026-07-29T12:00:00.000Z')
  assert.equal(rec.updated_at, '2026-07-29T12:01:00.000Z')
  assert.equal(rec.status, 'active')
})

test('closeSession marks the record closed and records the result', () => {
  const home = tmpHome()
  const r = registerSession({ home, sid: 's2', pid: 1, cwd: process.cwd() })
  closeSession({ home, sid: 's2', cwd: process.cwd(), result: 'failed' })
  const rec = readRecord(home, r.repo_id, 's2')
  assert.equal(rec.status, 'closed')
  assert.equal(rec.link_state, 'closed')
  assert.equal(rec.result_class, 'failed')
})

test('heartbeat on an unknown sid is a soft no-op, not a throw', () => {
  const home = tmpHome()
  const r = heartbeatSession({ home, sid: 'never-registered', cwd: process.cwd() })
  assert.equal(r.ok, false)
})
