import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { sessionsDir } from '../lib/paths.mjs'
import { handoffBucket, collectSessions, renderBoard, spinnerize, partitionSessions } from '../lib/board.mjs'
import { startTimeOf } from '../lib/tmux.mjs'
import { SPINNER_FRAMES } from '../lib/spinner.mjs'

const seed = (home, repoId, sid, rec) => {
  const dir = sessionsDir(home, repoId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${sid}.json`), JSON.stringify({ session_id: sid, ...rec }))
}
const NOW = Date.parse('2026-06-28T12:00:00.000Z')
const ago = (ms) => new Date(NOW - ms).toISOString()
const H = 3600000

test('handoffBucket buckets by age', () => {
  assert.equal(handoffBucket(null, NOW).bucket, 'none')
  assert.equal(handoffBucket(ago(1 * H), NOW).bucket, 'fresh')
  assert.equal(handoffBucket(ago(4 * H), NOW).bucket, 'aging')
  assert.equal(handoffBucket(ago(20 * H), NOW).bucket, 'stale')
})

test('collectSessions enriches liveness + sorts newest-first; dead pid → dead', () => {
  const home = mkTmp('sage-b-')
  const id = 'repo-aaaa1111'
  seed(home, id, 'old', { branch: 'a', updated_at: ago(10 * H), last_tool_at: ago(10 * H) })
  seed(home, id, 'dead', { branch: 'b', pid: 2147483646, updated_at: ago(1 * H) })
  const out = collectSessions(home, id, NOW)
  assert.equal(out[0].session_id, 'dead') // newest updated_at first
  assert.equal(out.find((s) => s.session_id === 'dead').liveness, 'dead')
})

test('collectSessions: missing repo → []', () => {
  assert.deepEqual(collectSessions(mkTmp('sage-b-'), 'nope-0000', NOW), [])
})

test('renderBoard shows branches + bucket; empty → no sessions', () => {
  const home = mkTmp('sage-b-')
  const id = 'repo-bbbb2222'
  seed(home, id, 's1', { branch: 'feat-x', dirty: true, touched_globs: ['a.ts'], handoff_at: ago(1 * H) })
  const txt = renderBoard(collectSessions(home, id, NOW), { repoId: id, now: NOW })
  assert.match(txt, /feat-x/)
  assert.match(txt, /fresh/)
  assert.match(renderBoard([], { repoId: id, now: NOW }), /no sessions/)
})

test('renderBoard is branch-led with zone + ✎ + balanced header; UUID hidden', () => {
  const sessions = [
    { session_id: 'uuid-aaaa1111', branch: 'feat/auth', liveness: 'active', dirty: true,
      touched_globs: ['src/auth/x.ts', 'src/auth/y.ts'], handoff_bucket: 'fresh', handoff_age: '8m ago',
      ctx_used: 62, ctx_window: 100 },
  ]
  const txt = renderBoard(sessions, { repoId: 'repo' })
  assert.match(txt, /^SAGE · repo · 1 session\n/) // singular, no "board"
  assert.match(txt, /feat\/auth ✎/) // branch identity + uncommitted marker
  assert.match(txt, /src\/auth\//) // zone = where they work
  assert.match(txt, /active · 62%/) // status carries ctx
  assert.ok(!txt.includes('uuid-aaaa1111')) // UUID hidden by default
})

test('renderBoard flags an orphan (dead holds a row); --wide reveals the sid', () => {
  const sessions = [
    { session_id: 'deadbeef-9999', branch: 'feat/x', liveness: 'dead', row: 'M3',
      handoff_bucket: 'stale', handoff_age: '3h ago', touched_globs: ['data/loader.py'] },
  ]
  const plain = renderBoard(sessions, { repoId: 'repo' })
  assert.match(plain, /↳M3 ⚠/)
  assert.ok(!plain.includes('deadbeef'))
  assert.match(renderBoard(sessions, { repoId: 'repo', wide: true }), /deadbeef/) // reachable for link/unlink
})

test('spinnerize swaps the ● of working rows only; header + idle untouched', () => {
  const sessions = [
    { branch: 'feat/a', liveness: 'working', touched_globs: ['src/a.ts'] },
    { branch: 'feat/b', liveness: 'idle', touched_globs: ['src/b.ts'] },
  ]
  const text = renderBoard(sessions, { repoId: 'repo' })
  const frame = SPINNER_FRAMES[0]
  const out = spinnerize(text, sessions, frame).split('\n')
  assert.ok(out[0].startsWith('SAGE ·')) // header untouched
  assert.equal(out[1], '') // blank line untouched
  assert.ok(out[2].startsWith(`${frame} feat/a`)) // active row leads with the frame
  assert.ok(out[3].startsWith('● feat/b')) // idle row keeps its static ●
})

test('spinnerize also animates compacting rows (treated as busy)', () => {
  const sessions = [
    { branch: 'feat/c', liveness: 'working', phase: 'compacting', touched_globs: ['src/c.ts'] },
    { branch: 'feat/d', liveness: 'idle', touched_globs: ['src/d.ts'] },
  ]
  const text = renderBoard(sessions, { repoId: 'repo' })
  const frame = SPINNER_FRAMES[0]
  const out = spinnerize(text, sessions, frame).split('\n')
  assert.ok(out[2].startsWith(`${frame} feat/c`)) // compacting spins (busy)
  assert.ok(out[3].startsWith('● feat/d'))
})

test('spinnerize leaves an empty board untouched', () => {
  const text = renderBoard([], { repoId: 'repo' })
  assert.equal(spinnerize(text, [], SPINNER_FRAMES[0]), text)
})

test('collectSessions: backfills session_id from filename when body omits it', () => {
  const home = mkTmp()
  const repoId = 'demo-repo-1234abcd'
  const dir = sessionsDir(home, repoId)
  fs.mkdirSync(dir, { recursive: true })
  // id-less body, exactly like the real legacy records (keys: link_state,status,liveness,updated_at)
  fs.writeFileSync(
    path.join(dir, 'ghost-sid-1.json'),
    JSON.stringify({ link_state: 'closed', status: 'closed', liveness: 'closed', updated_at: new Date().toISOString() }),
  )
  const out = collectSessions(home, repoId, Date.now())
  assert.equal(out.length, 1)
  assert.equal(out[0].session_id, 'ghost-sid-1', 'sid backfilled from filename')
})

test('pid-less non-closed record → dead (honest liveness)', () => {
  const home = mkTmp('sage-b-')
  const id = 'repo-cccc3333'
  // no pid, recent tool activity — the old default read this alive/working
  seed(home, id, 'ghost', { branch: 'main', updated_at: ago(1000), last_tool_at: ago(1000) })
  const out = collectSessions(home, id, NOW)
  assert.equal(out[0].liveness, 'dead')
})

test('collectSessions: pid_start match → alive, mismatch → dead (recycle-proof)', () => {
  const home = mkTmp('sage-b-')
  const id = 'repo-dddd4444'
  const realStart = startTimeOf(process.pid) // '' on a non-/proc platform
  // matching start-time + recent activity → not dead (Linux: working;
  // non-/proc: realStart '' opts out → plain probe → alive)
  seed(home, id, 'match', {
    branch: 'a', pid: process.pid, pid_start: realStart,
    last_tool_at: ago(1000), updated_at: ago(1000),
  })
  // a WRONG start-time means the pid was recycled → dead, even though pid is live
  seed(home, id, 'recycled', {
    branch: 'b', pid: process.pid, pid_start: '1', updated_at: ago(2000),
  })
  const out = collectSessions(home, id, NOW)
  assert.notEqual(out.find((s) => s.session_id === 'match').liveness, 'dead')
  assert.equal(out.find((s) => s.session_id === 'recycled').liveness, 'dead')
})

// ── Phase 5 Child A: live-first roster + archive fold + ctx gauge (s1/s2) ──

const LIVE = (id, over = {}) => ({
  session_id: id,
  branch: over.branch || `feat/${id}`,
  liveness: over.liveness || 'working',
  dirty: !!over.dirty,
  touched_globs: over.touched_globs || [`src/${id}/a.ts`],
  handoff_bucket: over.handoff_bucket || 'fresh',
  handoff_age: over.handoff_age || '4m ago',
  ctx_used: over.ctx_used,
  ctx_window: over.ctx_window,
  phase: over.phase,
  row: over.row,
  updated_at: over.updated_at || '2026-06-28T12:00:00.000Z',
})

const DEAD = (id, over = {}) => ({
  session_id: id,
  branch: over.branch || 'main',
  liveness: over.liveness || 'dead',
  dirty: false,
  touched_globs: over.touched_globs || [],
  handoff_bucket: over.handoff_bucket || 'stale',
  handoff_age: over.handoff_age || '3d ago',
  updated_at: over.updated_at || '2026-06-20T12:00:00.000Z',
  ...over,
})

test('s1: 3 live + 80 dead → live on top with headers + gauges; one archive fold', () => {
  const live = [
    LIVE('a', { liveness: 'working', ctx_used: 80, ctx_window: 100, touched_globs: ['docs/superpowers/x.md'] }),
    LIVE('b', { liveness: 'idle', ctx_used: 40, ctx_window: 100, touched_globs: ['lib/board.mjs'] }),
    LIVE('c', { liveness: 'working', phase: 'compacting', ctx_used: 20, ctx_window: 100, touched_globs: ['bin/sage'] }),
  ]
  const dead = Array.from({ length: 80 }, (_, i) => DEAD(`d${i}`, { branch: i % 2 ? 'main' : '(none)' }))
  const sessions = [...dead, ...live] // dead first in input — must not dominate output
  const txt = renderBoard(sessions, { repoId: 'repo' })
  const lines = txt.split('\n')

  // header announces live + archive, not "83 sessions" landfill
  assert.match(lines[0], /3 live/)
  assert.match(lines[0], /80 archive/)

  // column headers present
  assert.match(txt, /\bBRANCH\b/)
  assert.match(txt, /\bSTATUS\b/)
  assert.match(txt, /\bZONE\b/)
  assert.match(txt, /\bAGE\b/)
  assert.match(txt, /\bCTX\b/)

  // live branches appear before the archive fold
  const foldIdx = lines.findIndex((l) => /▸ archive \(80\)/.test(l))
  assert.ok(foldIdx > 0, 'exactly one archive fold line')
  assert.equal(lines.filter((l) => /▸ archive/.test(l)).length, 1)

  const bodyBeforeFold = lines.slice(0, foldIdx).join('\n')
  assert.match(bodyBeforeFold, /feat\/a/)
  assert.match(bodyBeforeFold, /feat\/b/)
  assert.match(bodyBeforeFold, /feat\/c/)

  // dead branch landfill not expanded by default
  assert.ok(!txt.includes('● main'), 'dead main rows folded away')
  assert.ok(!/\(none\).*dead/.test(txt) || !lines.some((l) => l.startsWith('●') && l.includes('(none)') && l.includes('dead')))

  // only 3 live session lead-rows (● or ◆), not 83
  const leadRows = lines.filter((l) => /^[●◆] /.test(l))
  assert.equal(leadRows.length, 3)

  // ctx gauges present (block characters)
  assert.match(txt, /[█░]+/)
})

test('s1: --all expands archive; dead rows stay present and not live-marked', () => {
  const sessions = [
    LIVE('hot', { liveness: 'working', ctx_used: 50, ctx_window: 100 }),
    DEAD('old1', { branch: 'feat/old', liveness: 'dead' }),
    DEAD('old2', { branch: 'feat/gone', liveness: 'closed' }),
  ]
  const folded = renderBoard(sessions, { repoId: 'repo' })
  assert.match(folded, /▸ archive \(2\)/)
  assert.ok(!folded.includes('feat/old'))

  const all = renderBoard(sessions, { repoId: 'repo', all: true })
  assert.ok(!/▸ archive/.test(all), '--all has no fold line')
  assert.match(all, /feat\/old/)
  assert.match(all, /feat\/gone/)
  assert.match(all, /feat\/hot/)
  // live first
  const lines = all.split('\n').filter((l) => /^[●◆] /.test(l))
  assert.match(lines[0], /feat\/hot/)
})

test('s1: non-TTY row grammar is stable (plain text, parseable columns)', () => {
  const sessions = [
    LIVE('x', { liveness: 'idle', ctx_used: 10, ctx_window: 100, dirty: true }),
    DEAD('y'),
  ]
  const txt = renderBoard(sessions, { repoId: 'repo' })
  assert.equal(txt.includes('\x1b['), false, 'renderer emits zero ANSI')
  assert.match(txt, /^SAGE · repo · /m)
  assert.match(txt, /▸ archive \(1\)/)
  // live row keeps branch-led grammar + status token
  assert.match(txt, /[●◆] feat\/x ✎/)
  assert.match(txt, /idle/)
})

test('s2: zone names never mid-clip; ctx gauge reflects fixture percentages', () => {
  const sessions = [
    LIVE('z1', {
      liveness: 'working',
      ctx_used: 100,
      ctx_window: 100,
      touched_globs: ['docs/superpowers/specs/design.md'],
    }),
    LIVE('z2', {
      liveness: 'idle',
      ctx_used: 0,
      ctx_window: 100,
      touched_globs: ['lib/color.mjs'],
    }),
  ]
  const txt = renderBoard(sessions, { repoId: 'repo' })
  // full zone dirs present — never mid-clip garbage like bare "ocs/" from "docs/"
  assert.match(txt, /docs\/superpowers\//)
  assert.ok(!/(?:^|\s)ocs\//m.test(txt), 'no mid-clip bare ocs/ zone')
  assert.match(txt, /lib\//)

  // 100% → full gauge blocks; 0% → empty (all light)
  assert.match(txt, /█████/) // 5-col full
  assert.match(txt, /░░░░░/) // 5-col empty
  // status still carries percent for back-compat consumers
  assert.match(txt, /100%/)
  assert.match(txt, /0%/)
})

test('s2: long zone keeps a readable tail (left-ellipsis, not middle garbage)', () => {
  // force a narrow zone budget via cols so clipping is exercised
  const sessions = [
    LIVE('deep', {
      liveness: 'working',
      touched_globs: ['docs/superpowers/specs/very-long-name-here.md'],
      ctx_used: 50,
      ctx_window: 100,
    }),
  ]
  const txt = renderBoard(sessions, { repoId: 'repo', cols: 60 })
  // must not produce mid-clip "ocs/" style garbage; either full path or …tail
  assert.ok(!/ocs\//.test(txt), 'no mid-clip ocs/')
  assert.ok(
    /docs\/superpowers\//.test(txt) || /…/.test(txt) || /specs\//.test(txt),
    'zone readable',
  )
})

test('partition: live-first sort ranks working above idle above dead', () => {
  const { live, archive } = partitionSessions([
    DEAD('d'),
    LIVE('i', { liveness: 'idle' }),
    LIVE('w', { liveness: 'working' }),
  ])
  assert.equal(live.map((s) => s.session_id).join(','), 'w,i')
  assert.equal(archive.length, 1)
  assert.equal(archive[0].session_id, 'd')
})
