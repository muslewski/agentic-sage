import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { writeRecord } from '../lib/store.mjs'
import { resolveSelfSid } from '../lib/self.mjs'

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sage-self-'))
const ID = 'r1'

test('SAGE_SELF_SID env wins', () => {
  assert.equal(resolveSelfSid(tmpHome(), ID, { env: { SAGE_SELF_SID: 'envsid' } }), 'envsid')
})

test('pid-walk matches a record by pid', () => {
  const h = tmpHome()
  writeRecord(h, ID, 'sid-A', {
    session_id: 'sid-A',
    pid: process.pid,
    updated_at: '2026-06-28T00:00:00Z',
  })
  assert.equal(resolveSelfSid(h, ID, { pid: process.pid, env: {} }), 'sid-A')
})

test('no env + no matching pid → null', () => {
  assert.equal(resolveSelfSid(tmpHome(), ID, { pid: 999999, env: {} }), null)
})
