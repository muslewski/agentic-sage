import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fleetLine } from '../lib/fleet.mjs'

const S = (over) => ({ liveness: 'idle', touched_globs: [], ...over })

test('fleetLine: 0 others → empty', () => {
  assert.equal(fleetLine([], {}), '')
  assert.equal(fleetLine([S({ session_id: 'self' })], { selfSid: 'self' }), '')
})

test('fleetLine: nearest = newest updated_at; excludes self/closed/dead', () => {
  const sessions = [
    S({ session_id: 'self', branch: 'feat-self', updated_at: '2026-06-28T13:00:00Z' }),
    S({ session_id: 'a', branch: 'feat-a', touched_globs: ['src/a.ts'], updated_at: '2026-06-28T11:00:00Z' }),
    S({ session_id: 'b', branch: 'feat-b', touched_globs: ['src/b.ts'], updated_at: '2026-06-28T12:00:00Z' }),
    S({ session_id: 'z', branch: 'feat-z', liveness: 'closed', updated_at: '2026-06-28T12:59:00Z' }),
    S({ session_id: 'd', branch: 'feat-d', liveness: 'dead', updated_at: '2026-06-28T12:58:00Z' }),
  ]
  assert.equal(fleetLine(sessions, { selfSid: 'self' }), '2 live · nearest feat-b touches src/b.ts')
})

test('fleetLine: no touched paths → em-dash', () => {
  const sessions = [S({ session_id: 'a', branch: 'feat-a', updated_at: '2026-06-28T11:00:00Z' })]
  assert.equal(fleetLine(sessions, {}), '1 live · nearest feat-a touches —')
})
