import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FACES,
  nextFace,
  prevFace,
  contestedPaths,
  buildClash,
  filterMemoryFleet,
  bodyModelClash,
  renderWarHeader,
  facePanelTotals,
  pickPrimarySession,
  faceCountsFromFleet,
} from '../lib/warfaces.mjs'
import { renderWarRoom } from '../lib/warroom.mjs'

test('nextFace / prevFace cycle LIVE · CLASH · MEMORY', () => {
  assert.deepEqual(FACES, ['live', 'clash', 'memory'])
  assert.equal(nextFace('live'), 'clash')
  assert.equal(nextFace('clash'), 'memory')
  assert.equal(nextFace('memory'), 'live')
  assert.equal(prevFace('live'), 'memory')
  assert.equal(prevFace('clash'), 'live')
})

test('contestedPaths: live multi-touch only; claimed counts; working first', () => {
  const paths = contestedPaths([
    { session_id: 'a', liveness: 'idle', branch: 'a', touched_globs: ['x.ts', 'solo.ts'] },
    { session_id: 'b', liveness: 'working', branch: 'b', touched_globs: ['x.ts'] },
    { session_id: 'c', liveness: 'closed', branch: 'c', touched_globs: ['x.ts'] }, // dead — ignore
    { session_id: 'd', liveness: 'idle', branch: 'd', claimed_globs: ['y.ts'], touched_globs: [] },
    { session_id: 'e', liveness: 'stalled', branch: 'e', claimed_globs: ['y.ts'], touched_globs: [] },
  ])
  assert.equal(paths.length, 2)
  assert.equal(paths[0].path, 'x.ts') // more sessions / severity sort — both have 2
  assert.equal(paths[0].sessions[0].liveness, 'working') // hottest first
  assert.ok(paths.some((p) => p.path === 'y.ts'))
  assert.equal(pickPrimarySession(paths[0].sessions).liveness, 'working')
})

test('buildClash: groups paths by repo; empty when clear', () => {
  const fleet = {
    totals: {},
    repos: [
      {
        repoId: 'r1-aaaaaaaa',
        label: 'r1',
        sessions: [
          { session_id: 'a', liveness: 'working', branch: 'a', touched_globs: ['p.ts'] },
          { session_id: 'b', liveness: 'idle', branch: 'b', touched_globs: ['p.ts'] },
        ],
      },
      {
        repoId: 'r2-bbbbbbbb',
        label: 'r2',
        sessions: [{ session_id: 'c', liveness: 'working', branch: 'c', touched_globs: ['only.ts'] }],
      },
    ],
  }
  const c = buildClash(fleet)
  assert.equal(c.totals.paths, 1)
  assert.equal(c.repos.length, 1)
  assert.equal(c.repos[0].label, 'r1')
  assert.equal(buildClash({ repos: [] }).totals.paths, 0)
})

test('filterMemoryFleet: only dead/closed', () => {
  const fleet = {
    totals: { sessions: 3, live: 1 },
    repos: [
      {
        repoId: 'r',
        label: 'r',
        sessions: [
          { session_id: 'live', liveness: 'working' },
          { session_id: 'd', liveness: 'dead' },
          { session_id: 'c', liveness: 'closed' },
        ],
      },
    ],
  }
  const m = filterMemoryFleet(fleet)
  assert.equal(m.repos[0].sessions.length, 2)
  assert.ok(m.repos[0].sessions.every((s) => s.liveness === 'dead' || s.liveness === 'closed'))
})

test('bodyModelClash: empty calm; path tree when contested', () => {
  const empty = bodyModelClash({ repos: [] }, { cols: 80 })
  assert.ok(empty.some((m) => /no live contests/.test(m.text)))
  const clash = buildClash({
    repos: [
      {
        repoId: 'r1-aaaaaaaa',
        label: 'alpha',
        sessions: [
          { session_id: 'a', liveness: 'working', window_name: 'sage', branch: 'main', touched_globs: ['lib/x.mjs'] },
          { session_id: 'b', liveness: 'idle', window_name: 'hermes', branch: 'feat', touched_globs: ['lib/x.mjs'] },
        ],
      },
    ],
  })
  const model = bodyModelClash(clash, { cols: 80 })
  assert.ok(model.some((m) => m.isHeader && /alpha/.test(m.text)))
  assert.ok(model.some((m) => /⚔/.test(m.text) && /lib\/x/.test(m.text)))
  assert.ok(model.some((m) => m.session && m.session.session_id === 'a'))
})

test('renderWarHeader: contains active face, counts, fits width', () => {
  const counts = { live: 12, clash: 1, memory: 600 }
  for (const face of FACES) {
    const line = renderWarHeader(face, '12:00:00', 80, counts)
    assert.ok([...line].length <= 80, line)
    assert.match(line, /SAGE WAR/)
    assert.match(line, new RegExp(face === 'live' ? 'LIVE' : face === 'clash' ? 'CLASH' : 'MEMORY'))
  }
  assert.match(renderWarHeader('live', '12:00:00', 80, counts), /12/)
})

test('faceCountsFromFleet', () => {
  const fleet = {
    totals: { live: 3 },
    repos: [
      {
        repoId: 'r',
        label: 'r',
        sessions: [
          { session_id: 'a', liveness: 'working', touched_globs: ['p'] },
          { session_id: 'b', liveness: 'idle', touched_globs: ['p'] },
          { session_id: 'd', liveness: 'dead', touched_globs: [] },
        ],
      },
    ],
  }
  const c = faceCountsFromFleet(fleet, 1)
  assert.equal(c.live, 3)
  assert.equal(c.clash, 1)
  assert.equal(c.memory, 1)
})

test('facePanelTotals: clash and memory tags', () => {
  const c = facePanelTotals('clash', { working: 2 }, { paths: 5, repos: 2, sessions: 4 })
  assert.equal(c._clash, true)
  assert.equal(c.paths, 5)
  const m = facePanelTotals('memory', { sessions: 100, live: 5 }, {}, { dead: 90, repos: 3 })
  assert.equal(m._memory, true)
  assert.equal(m.dead, 90)
})

test('renderWarRoom: clash face uses path header row', () => {
  const fleet = { totals: { repos: 0, sessions: 0, live: 0, working: 0, contested: 0, human: 0, nested: 0 }, repos: [] }
  const frame = renderWarRoom(fleet, {
    face: 'clash',
    cols: 80,
    rows: 24,
    clock: '12:00:00',
    headerLine: renderWarHeader('clash', '12:00:00', 80),
    panelTotals: facePanelTotals('clash', {}, { paths: 0, repos: 0, sessions: 0 }),
    model: bodyModelClash({ repos: [] }, { cols: 80 }),
    hideColumnHeader: true,
  })
  assert.match(frame, /CLASH|clash/)
  assert.match(frame, /no live contests|PATHS/)
})
