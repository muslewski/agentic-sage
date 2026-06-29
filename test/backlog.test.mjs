import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRow, backlogStatus, renderBacklog } from '../lib/backlog.mjs'

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
