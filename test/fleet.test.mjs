import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fleetLine } from '../lib/fleet.mjs'
import { mkTmp } from './helpers.mjs'
import { sessionsDir } from '../lib/paths.mjs'
import { collectFleet, filterFleet, sortFleet, isNested, tally } from '../lib/fleet.mjs'

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

const NOW = Date.parse('2026-07-11T12:00:00.000Z')
const ago = (ms) => new Date(NOW - ms).toISOString()
const H = 3600000
const seedF = (home, repoId, sid, rec) => {
  const dir = sessionsDir(home, repoId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${sid}.json`), JSON.stringify({ session_id: sid, ...rec }))
}

test('collectFleet aggregates sessions + totals across repos', () => {
  const home = mkTmp('sage-cf-')
  // repo A: one working, one idle
  seedF(home, 'alpha-aaaa1111', 'w', { branch: 'main', pid: process.pid, updated_at: ago(1 * H), last_tool_at: ago(1000) })
  seedF(home, 'alpha-aaaa1111', 'i', { branch: 'feat', pid: process.pid, updated_at: ago(2 * H) })
  // repo B: one dead (pid gone)
  seedF(home, 'beta-bbbb2222', 'd', { branch: 'x', pid: 2147483646, updated_at: ago(3 * H) })
  const f = collectFleet(home, NOW)
  assert.equal(f.totals.repos, 2)
  assert.equal(f.totals.sessions, 3)
  assert.equal(f.totals.live, 2) // working + idle (dead is not live)
  assert.equal(f.totals.working, 1)
  const alpha = f.repos.find((r) => r.repoId === 'alpha-aaaa1111')
  assert.equal(alpha.label, 'alpha') // trailing -hash stripped
  assert.equal(alpha.live, 2)
})

test('collectFleet: empty fleet → zero totals, no throw', () => {
  const f = collectFleet(mkTmp('sage-cf-'), NOW)
  assert.deepEqual(f.repos, [])
  assert.equal(f.totals.sessions, 0)
})

test('filterFleet drops dead sessions + empty repos unless showAll', () => {
  const home = mkTmp('sage-ff-')
  seedF(home, 'alpha-aaaa1111', 'w', { branch: 'main', pid: process.pid, updated_at: ago(1 * H), last_tool_at: ago(1000) })
  seedF(home, 'beta-bbbb2222', 'd', { branch: 'x', pid: 2147483646, updated_at: ago(3 * H) })
  const f = collectFleet(home, NOW)
  const hidden = filterFleet(f, { showAll: false })
  assert.deepEqual(hidden.repos.map((r) => r.repoId), ['alpha-aaaa1111']) // beta (dead-only) gone
  assert.equal(hidden.totals.sessions, 2) // totals preserved
  const all = filterFleet(f, { showAll: true })
  assert.equal(all.repos.length, 2)
})

test('sortFleet orders repos by recency, sessions by liveness', () => {
  const home = mkTmp('sage-sf-')
  seedF(home, 'old-aaaa1111', 'a', { branch: 'a', updated_at: ago(10 * H) })
  seedF(home, 'new-bbbb2222', 'b', { branch: 'b', pid: process.pid, updated_at: ago(1 * H), last_tool_at: ago(1000) })
  seedF(home, 'new-bbbb2222', 'c', { branch: 'c', updated_at: ago(30 * 60000) }) // idle, newer
  const f = sortFleet(collectFleet(home, NOW))
  assert.equal(f.repos[0].repoId, 'new-bbbb2222') // most-recent activity first
  assert.equal(f.repos[0].sessions[0].liveness, 'working') // working ranks above idle
})

test('isNested: managed_by nested → true; human/absent → false', () => {
  assert.equal(isNested({ managed_by: 'nested' }), true)
  assert.equal(isNested({ managed_by: 'human' }), false)
  assert.equal(isNested({}), false)
})

test('tally counts live/working/human/nested (live-first; dead nested does not inflate)', () => {
  const rows = [
    { liveness: 'working', managed_by: 'human' },
    { liveness: 'idle', managed_by: 'human' },
    { liveness: 'idle', managed_by: 'nested' },
    { liveness: 'dead', managed_by: 'nested' },
  ]
  // human/nested over LIVE only — dead nested is storage, not the army
  assert.deepEqual(tally(rows), { live: 3, working: 1, nested: 1, human: 2, compacting: 0 })
})

test('collectFleet totals split human vs nested', () => {
  const home = mkTmp('sage-cf-')
  seedF(home, 'gamma-aaaa1111', 'h', { branch: 'main', pid: process.pid, updated_at: ago(1 * H), managed_by: 'human' })
  seedF(home, 'gamma-aaaa1111', 'n', { branch: 'wt', pid: process.pid, updated_at: ago(1 * H), managed_by: 'nested' })
  const f = collectFleet(home, NOW)
  assert.equal(f.totals.human, 1)
  assert.equal(f.totals.nested, 1)
  const g = f.repos.find((r) => r.repoId === 'gamma-aaaa1111')
  assert.equal(g.human, 1)
  assert.equal(g.nested, 1)
})
