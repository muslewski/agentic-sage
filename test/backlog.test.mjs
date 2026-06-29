import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { resolveRow, backlogStatus, renderBacklog } from '../lib/backlog.mjs'
import { mkTmp } from './helpers.mjs'
import { backlogRows } from '../adapters/syndcast.mjs'

const live = (id, row, extra = {}) => ({ session_id: id, alive: true, resolvedRow: row, ...extra })
const dead = (id, row, extra = {}) => ({ session_id: id, alive: false, resolvedRow: row, ...extra })

test('resolveRow: explicit claim beats inference beats null', () => {
  assert.equal(resolveRow({ claimed_row: 'A5' }, 'D9'), 'A5')
  assert.equal(resolveRow({}, 'D9'), 'D9')
  assert.equal(resolveRow({}, null), null)
  assert.equal(resolveRow(null, null), null)
})

test('backlogStatus: a live holder ⇒ held; ⬜ in .md ⇒ held-but-open drift', () => {
  const rows = [{ id: 'D11', status: '⬜', mission: 'thing' }]
  const [r] = backlogStatus(rows, [live('s1', 'D11', { branch: 'feat-x' })], 0)
  assert.equal(r.derived, 'held')
  assert.equal(r.liveHolders.length, 1)
  assert.equal(r.drift, 'held-but-open')
})

test('backlogStatus: 🟡 row whose only holder is dead ⇒ orphaned', () => {
  const rows = [{ id: 'D11', status: '🟡', mission: 'thing' }]
  const [r] = backlogStatus(rows, [dead('s1', 'D11')], 0)
  assert.equal(r.derived, 'free')
  assert.equal(r.deadHolders.length, 1)
  assert.equal(r.drift, 'orphaned')
})

test('backlogStatus: 🟡 row with no holders at all ⇒ stale-open', () => {
  const [r] = backlogStatus([{ id: 'A5', status: '🟡' }], [], 0)
  assert.equal(r.drift, 'stale-open')
})

test('backlogStatus: ✅ row is never drifted, even if live-held', () => {
  const [r] = backlogStatus([{ id: 'D9', status: '✅' }], [live('s1', 'D9')], 0)
  assert.equal(r.drift, 'none')
})

test('backlogStatus: a closed/unlinked session does not hold a row', () => {
  const rows = [{ id: 'D11', status: '⬜' }]
  const [r] = backlogStatus(rows, [live('s1', 'D11', { link_state: 'unlinked' })], 0)
  assert.equal(r.liveHolders.length, 0)
  assert.equal(r.drift, 'none')
})

test('renderBacklog: quiet when clear, flags drift when present', () => {
  const clear = renderBacklog(backlogStatus([{ id: 'D9', status: '✅' }], [], 0), { repoId: 'r1' })
  assert.match(clear, /fleet clear/i)
  const drifted = renderBacklog(
    backlogStatus([{ id: 'D11', status: '⬜' }], [live('s1', 'D11', { branch: 'feat-x' })], 0),
    { repoId: 'r1' },
  )
  assert.match(drifted, /D11/)
  assert.match(drifted, /held by s1/)
  assert.match(drifted, /held-but-open|mark 🟡/)
})

// ── Task 2: adapter backlogRows ───────────────────────────────────────────────

const fixtureRepo = (backlog) => {
  const root = mkTmp('sage-mind-')
  fs.mkdirSync(path.join(root, 'syndcast-mind'), { recursive: true })
  fs.writeFileSync(path.join(root, 'syndcast-mind', 'BACKLOG.md'), backlog)
  return root
}

const BACKLOG = `# Backlog

- [x] **A0 — Prereq: merged thing.** done.
- [ ] **A5 — PermissionModes collection.** governance floor.
- [ ] **B5 — Builtin describe.** 🟡 partial.

## D. Side Missions

| ID | Mission | Status | Lands | Notes |
|---|---|---|---|---|
| D9 | Int-test rehab | ✅ | fix/editor-test-type-drift | done |
| D11 | next side mission | ⬜ | \`feat/…\` | — |
`

test('backlogRows: parses A/B/C checklist + the D table with column-scoped status', () => {
  const root = fixtureRepo(BACKLOG)
  const rows = backlogRows({ repoRoot: root })
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
  assert.equal(byId.A0.status, '✅')          // [x] → done
  assert.equal(byId.A5.status, '⬜')          // [ ], no glyph → open
  assert.equal(byId.B5.status, '🟡')          // [ ] + inline 🟡 → in-progress
  assert.equal(byId.D9.status, '✅')          // Status COLUMN, not the first glyph
  assert.equal(byId.D9.lands, 'fix/editor-test-type-drift')
  assert.equal(byId.D11.status, '⬜')
  assert.match(byId.A5.mission, /PermissionModes/)
})

test('backlogRows: missing or garbage backlog → []', () => {
  assert.deepEqual(backlogRows({ repoRoot: mkTmp('sage-empty-') }), []) // no syndcast-mind/BACKLOG.md
  assert.deepEqual(backlogRows({ repoRoot: fixtureRepo('not a table\njust prose\n') }), [])
})
