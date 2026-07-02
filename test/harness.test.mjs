import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getHarness } from '../lib/harness.mjs'

test('getHarness("claude") returns paths ending as expected', () => {
  const h = getHarness('claude')
  assert.ok(h.home('/h').endsWith('/.claude'))
  assert.ok(h.settings('/h').endsWith('/.claude/settings.json'))
  assert.ok(h.projectSettings('/r').endsWith('/.claude/settings.json'))
  assert.ok(h.hooksDir('/h').endsWith('/.claude/hooks'))
  assert.ok(h.skillsDir('/h').endsWith('/.claude/skills'))
  assert.ok(h.storageDefault('/h').endsWith('/.claude/agentic-sage'))
  assert.equal(h.tmux, true)
})

test('getHarness() defaults to claude', () => {
  assert.equal(getHarness().id, 'claude')
})

test('getHarness("nope") returns null', () => {
  assert.equal(getHarness('nope'), null)
})
