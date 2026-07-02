import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { lastToolFile, postToolDue, markPostTool } from '../lib/throttle.mjs'

test('absent breadcrumb ⇒ due', () => {
  const home = mkTmp('sage-h-')
  assert.equal(postToolDue(home, 's1', Date.now(), 30000), true)
})

test('markPostTool then postToolDue within the window ⇒ not due', () => {
  const home = mkTmp('sage-h-')
  markPostTool(home, 's1')
  assert.equal(postToolDue(home, 's1', Date.now(), 30000), false)
})

test('a backdated breadcrumb past the window ⇒ due', () => {
  const home = mkTmp('sage-h-')
  markPostTool(home, 's1')
  const f = lastToolFile(home, 's1')
  const old = new Date(Date.now() - 60_000)
  fs.utimesSync(f, old, old)
  assert.equal(postToolDue(home, 's1', Date.now(), 30000), true)
})

test('a sid containing separators produces a flat filename (no subdir created)', () => {
  const home = mkTmp('sage-h-')
  markPostTool(home, '../../etc/passwd')
  const f = lastToolFile(home, '../../etc/passwd')
  assert.equal(path.dirname(f), path.join(home, '.claude', 'agentic-sage', 'last-tool'))
  assert.equal(fs.existsSync(path.join(home, 'etc', 'passwd')), false)
})
