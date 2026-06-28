import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sessionFile, globalConfig, eventsFile, repoConfig } from '../lib/paths.mjs'

test('sessionFile path shape', () => {
  assert.ok(sessionFile('/h', 'r', 's').endsWith('/.claude/sage/repos/r/sessions/s.json'))
})

test('globalConfig path shape', () => {
  assert.ok(globalConfig('/h').endsWith('/.claude/sage/config.json'))
})

test('eventsFile + repoConfig path shape', () => {
  assert.ok(eventsFile('/h', 'r').endsWith('/.claude/sage/repos/r/events.ndjson'))
  assert.ok(repoConfig('/h', 'r').endsWith('/.claude/sage/repos/r/config.json'))
})
