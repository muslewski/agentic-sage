import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fleetLine } from '../lib/fleet.mjs'
import { mkTmp } from './helpers.mjs'
import { sessionsDir } from '../lib/paths.mjs'
import {
  collectFleet,
  filterFleet,
  sortFleet,
  isNested,
  tally,
  contestedCount,
  isOrphanRepo,
  activitySpark,
  liveGauge,
  buildReposView,
  renderRepos,
  fzfRepoLine,
  composeHud,
  fleetHud,
} from '../lib/fleet.mjs'

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

test('sortFleet: band order is STABLE across session-count/activity changes; sessions live-first', () => {
  const home = mkTmp('sage-sf-')
  seedF(home, 'old-aaaa1111', 'a', { branch: 'a', updated_at: ago(10 * H) })
  seedF(home, 'new-bbbb2222', 'b', { branch: 'b', pid: process.pid, updated_at: ago(1 * H), last_tool_at: ago(1000) })
  seedF(home, 'new-bbbb2222', 'c', { branch: 'c', updated_at: ago(30 * 60000) }) // idle, newer
  const before = sortFleet(collectFleet(home, NOW)).repos.map((r) => r.repoId)
  // The reorder-on-count bug: adding a session to a repo must NOT reshuffle the
  // bands. A hot new session in the OTHER repo previously yanked it to the top.
  seedF(home, 'old-aaaa1111', 'd', { branch: 'd', pid: process.pid, updated_at: ago(60000), last_tool_at: ago(500) })
  const after = sortFleet(collectFleet(home, NOW)).repos.map((r) => r.repoId)
  assert.deepEqual(after, before) // spatially stable regardless of counts/activity
  // Within a band, working still ranks above idle.
  const nb = sortFleet(collectFleet(home, NOW)).repos.find((r) => r.repoId === 'new-bbbb2222')
  assert.equal(nb.sessions[0].liveness, 'working')
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

test('contestedCount: live multi-touch only; dead ignored (no re-read)', () => {
  assert.equal(
    contestedCount([
      { liveness: 'idle', touched_globs: ['a.ts', 'b.ts'] },
      { liveness: 'working', touched_globs: ['a.ts'] },
      { liveness: 'closed', touched_globs: ['a.ts'] }, // dead — must not count
    ]),
    1,
  )
  assert.equal(contestedCount([{ liveness: 'idle', touched_globs: ['solo.ts'] }]), 0)
})

// ── Phase 5 Child B s5: repos groups + fleet HUD (no empty chips) ───────────

test('s5: isOrphanRepo flags subagent UUID noise; product names stay product', () => {
  assert.equal(isOrphanRepo('subagent-019f5d70-aaaa-bbbb'), true)
  assert.equal(isOrphanRepo('subagent-019f5d70-aaaa-bbbb-deadbeef'), true)
  assert.equal(isOrphanRepo('agentic-sage-0e480620'), false)
  assert.equal(isOrphanRepo('hermes-aabbccdd'), false)
})

test('s5: activitySpark buckets timestamps; liveGauge reflects live/total', () => {
  assert.equal(activitySpark([]), '')
  const now = NOW
  const ts = [now - 1 * H, now - 3 * H, now - 6 * H, now - 12 * H, now - 20 * H]
  const spark = activitySpark(ts, { now, buckets: 8, windowMs: 24 * H })
  assert.match(spark, /^[▁▂▃▄▅▆▇█]+$/u)
  assert.equal(spark.length, 8)
  assert.equal(liveGauge(0, 0), '░░░░░')
  assert.match(liveGauge(2, 4), /[█░]+/)
  assert.equal(liveGauge(4, 4), '█████') // 100% full
})

test('s5: buildReposView + renderRepos groups product vs orphan; filters subagent noise by default', () => {
  const home = mkTmp('sage-rv-')
  seedF(home, 'hermes-aaaa1111', 'w', {
    branch: 'main',
    pid: process.pid,
    updated_at: ago(1 * H),
    last_tool_at: ago(1000),
  })
  seedF(home, 'hermes-aaaa1111', 'i', { branch: 'feat', pid: process.pid, updated_at: ago(2 * H) })
  seedF(home, 'agentic-sage-bbbb2222', 'a', {
    branch: 'main',
    pid: process.pid,
    updated_at: ago(3 * H),
  })
  seedF(home, 'subagent-019f5d70-cccc3333', 's', {
    branch: 'main',
    updated_at: ago(4 * H),
  })
  const fleet = collectFleet(home, NOW)
  const view = buildReposView(fleet, { now: NOW })
  assert.equal(view.product.length, 2)
  assert.equal(view.orphan.length, 1)
  assert.ok(view.product.every((r) => !isOrphanRepo(r.repoId)))
  assert.ok(view.orphan.every((r) => isOrphanRepo(r.repoId)))

  const txt = renderRepos(view)
  assert.match(txt, /SAGE repos · 2 product/)
  assert.match(txt, /hermes/)
  assert.match(txt, /agentic-sage/)
  assert.match(txt, /[█░]+/) // live gauge
  assert.match(txt, /[▁▂▃▄▅▆▇█]+/u) // activity spark
  // orphan subagent noise folded by default
  assert.match(txt, /▸ orphans? \(1\)/)
  assert.ok(!txt.includes('subagent-019f5d70'), 'orphan body folded by default')

  const all = renderRepos(view, { all: true })
  assert.match(all, /subagent/)
})

test('s5: fzfRepoLine ends with repoId for board jump parse-back', () => {
  const line = fzfRepoLine({
    repoId: 'hermes-aaaa1111',
    label: 'hermes',
    live: 2,
    sessions: 5,
    gauge: '██░░░',
    spark: '▁▂▄█',
  })
  assert.match(line, /hermes/)
  assert.match(line, /\thermes-aaaa1111$/)
})

test('s5: composeHud drops empty chips; fleetHud composes live/⚔/nearest', () => {
  assert.equal(composeHud(['18 live', '', null, '97 ⚔', undefined]), '18 live · 97 ⚔')
  assert.equal(composeHud([]), '')
  assert.equal(composeHud(['', null]), '')

  const sessions = [
    S({ session_id: 'self', branch: 'mine', updated_at: '2026-06-28T13:00:00Z', ctx_used: 50, ctx_window: 100 }),
    S({
      session_id: 'a',
      branch: 'feat-a',
      liveness: 'working',
      touched_globs: ['src/a.ts'],
      updated_at: '2026-06-28T12:00:00Z',
    }),
    S({
      session_id: 'b',
      branch: 'feat-b',
      liveness: 'idle',
      touched_globs: ['src/a.ts'],
      updated_at: '2026-06-28T11:00:00Z',
    }),
  ]
  const hud = fleetHud(sessions, { selfSid: 'self' })
  assert.match(hud, /2 live/)
  assert.match(hud, /⚔/) // contested chip present when paths overlap
  assert.match(hud, /nearest/)
  // no empty chips (no " ·  · " or trailing ·)
  assert.ok(!/·\s*·/.test(hud))
  assert.ok(!/·\s*$/.test(hud))

  // solo self → no empty chips; either empty or only self-ctx if provided
  const solo = fleetHud([S({ session_id: 'self', ctx_used: 60, ctx_window: 100 })], {
    selfSid: 'self',
    asking: true,
  })
  // asking pulse alone is fine; never empty separators
  assert.ok(!/·\s*·/.test(solo))
  if (solo) assert.match(solo, /Asking|ctx|⚖/)
})
