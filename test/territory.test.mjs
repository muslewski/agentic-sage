import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { sessionsDir } from '../lib/paths.mjs'
import {
  globToRegExp,
  overlaps,
  isGenerated,
  claimsOf,
  territory,
  whyDiverged,
  mergeBrief,
  renderTerritory,
  renderWhyDiverged,
  renderMergeBrief,
} from '../lib/territory.mjs'

const NOW = Date.parse('2026-06-28T12:00:00Z')

const seed = (home, repoId, recs) => {
  fs.mkdirSync(sessionsDir(home, repoId), { recursive: true })
  for (const r of recs)
    fs.writeFileSync(path.join(sessionsDir(home, repoId), `${r.session_id}.json`), JSON.stringify(r))
}

// ── Task 1: matcher + heuristics ────────────────────────────────────────────

test('globToRegExp: ** spans dirs, * is single-segment, ? is one char', () => {
  assert.ok(globToRegExp('src/**').test('src/a/b.ts'))
  assert.ok(globToRegExp('*.ts').test('x.ts'))
  assert.ok(!globToRegExp('*.ts').test('a/x.ts'))
  assert.ok(globToRegExp('a?.ts').test('ab.ts'))
  assert.ok(!globToRegExp('a?.ts').test('abc.ts'))
})

test('overlaps: exact, one-glob match, both-glob static-prefix', () => {
  assert.ok(overlaps('src/a.ts', 'src/a.ts'))
  assert.ok(!overlaps('src/a.ts', 'src/b.ts'))
  assert.ok(overlaps('src/**', 'src/auth/login.ts'))
  assert.ok(overlaps('src/auth/**', 'src/auth/x.ts'))
  assert.ok(!overlaps('src/auth/**', 'src/billing/**'))
})

test('isGenerated: lockfiles, dirs, markers; source false; extra glob', () => {
  assert.ok(isGenerated('pnpm-lock.yaml'))
  assert.ok(isGenerated('a/dist/x.js'))
  assert.ok(isGenerated('x.generated.ts'))
  assert.ok(!isGenerated('src/a.ts'))
  assert.ok(isGenerated('payload-types.ts', ['payload-types.ts']))
})

test('claimsOf: unions present fields, missing → []', () => {
  assert.deepEqual(claimsOf({ claimed_globs: ['a'], touched_globs: ['b'] }), {
    claimed: ['a'],
    touched: ['b'],
  })
  assert.deepEqual(claimsOf({}), { claimed: [], touched: [] })
})

// ── Task 2: data builders ───────────────────────────────────────────────────

test('territory: query overlaps via touched + claimed; selfSid excluded', () => {
  const home = mkTmp('sage-h-')
  const id = 'r1'
  seed(home, id, [
    { session_id: 'a', branch: 'feat-a', touched_globs: ['src/auth/login.ts'], updated_at: '2026-06-28T11:00:00Z' },
    { session_id: 'b', branch: 'feat-b', claimed_globs: ['src/auth/**'], updated_at: '2026-06-28T11:00:00Z' },
    { session_id: 'self', branch: 'feat-self', touched_globs: ['src/auth/x.ts'], updated_at: '2026-06-28T11:00:00Z' },
  ])
  const o = territory(home, id, ['src/auth/**'], { now: NOW, selfSid: 'self' })
  assert.deepEqual(o.map((x) => x.session_id).sort(), ['a', 'b'])
  assert.equal(o.find((x) => x.session_id === 'a').via, 'touched')
  assert.equal(o.find((x) => x.session_id === 'b').via, 'claimed')
})

test('whyDiverged: 2 sessions touch a file; generated flag set', () => {
  const home = mkTmp('sage-h-')
  const id = 'r1'
  seed(home, id, [
    { session_id: 'a', branch: 'feat-a', touched_globs: ['pnpm-lock.yaml'], updated_at: '2026-06-28T11:00:00Z' },
    { session_id: 'b', branch: 'feat-b', touched_globs: ['pnpm-lock.yaml'], updated_at: '2026-06-28T11:00:00Z' },
  ])
  const t = whyDiverged(home, id, 'pnpm-lock.yaml', { now: NOW })
  assert.equal(t.length, 2)
  assert.ok(t.every((x) => x.generated))
})

test('mergeBrief: file in >=2 sessions contested; single not; generated flagged', () => {
  const home = mkTmp('sage-h-')
  const id = 'r1'
  seed(home, id, [
    { session_id: 'a', branch: 'feat-a', touched_globs: ['shared.ts', 'a-only.ts'], updated_at: '2026-06-28T11:00:00Z' },
    { session_id: 'b', branch: 'feat-b', touched_globs: ['shared.ts', 'dist/x.js'], updated_at: '2026-06-28T11:00:00Z' },
  ])
  const c = mergeBrief(home, id, { now: NOW })
  const paths = c.map((x) => x.path)
  assert.ok(paths.includes('shared.ts'))
  assert.ok(!paths.includes('a-only.ts'))
  assert.equal(c.find((x) => x.path === 'shared.ts').sessions.length, 2)
  assert.ok(c.find((x) => x.path === 'dist/x.js') === undefined) // single session, not contested
})

// ── Task 4: renders ─────────────────────────────────────────────────────────

test('renderTerritory: overlap names branch; empty → clear', () => {
  const s = renderTerritory(
    [{ session_id: 'a', branch: 'feat-a', query: 'src/**', hit: 'src/x.ts', via: 'touched', liveness: 'idle', handoff_age: '—', generated: false }],
    { queries: ['src/**'] },
  )
  assert.match(s, /feat-a/)
  assert.match(renderTerritory([], { queries: ['src/**'] }), /clear/i)
})

test('renderWhyDiverged: lists branches + stat; empty → no other session', () => {
  const s = renderWhyDiverged(
    [{ session_id: 'a', branch: 'feat-a', via: 'touched', liveness: 'idle', handoff_age: '—', generated: false, stat: [{ added: 3, deleted: 1 }] }],
    { file: 'shared.ts' },
  )
  assert.match(s, /feat-a/)
  assert.match(s, /\+3\/-1/)
  assert.match(renderWhyDiverged([], { file: 'shared.ts' }), /no other session/i)
})

test('renderMergeBrief: contested path + generated rule; empty → none', () => {
  const s = renderMergeBrief(
    [{ path: 'pnpm-lock.yaml', generated: true, sessions: [{ session_id: 'a', branch: 'feat-a' }, { session_id: 'b', branch: 'feat-b' }] }],
    { repoId: 'r1' },
  )
  assert.match(s, /pnpm-lock\.yaml/)
  assert.match(s, /regenerate/i)
  assert.match(renderMergeBrief([], { repoId: 'r1' }), /no contested/i)
})
