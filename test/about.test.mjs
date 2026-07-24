import test from 'node:test'
import assert from 'node:assert/strict'
import {
  factsLine,
  tmuxSessionOfPane,
  findSessionForTmux,
  judgeLineFromBriefs,
  buildSessionLines,
  aboutTmux,
  renderAbout,
} from '../lib/about.mjs'

test('factsLine: war-row spirit fields', () => {
  const line = factsLine({
    liveness: 'working',
    branch: 'main',
    claimed_globs: ['src/**'],
    window_name: 'claude',
  })
  assert.match(line, /working/)
  assert.match(line, /main/)
  assert.match(line, /claim:src\/\*\*/)
  assert.match(line, /claude/)
})

test('factsLine: judge role chip', () => {
  const line = factsLine({ role: 'judge', liveness: 'working', branch: 'main' })
  assert.match(line, /judge/)
})

test('tmuxSessionOfPane splits session:window', () => {
  assert.equal(tmuxSessionOfPane('syndcast:0'), 'syndcast')
  assert.equal(tmuxSessionOfPane('open source:2'), 'open source')
})

test('findSessionForTmux matches pane session name', () => {
  const fleet = {
    repos: [
      {
        repoId: 'syndcast-aaaaaaaa',
        label: 'syndcast',
        sessions: [
          {
            session_id: 'abc',
            liveness: 'working',
            branch: 'feat',
            tmux: 'syndcast:0',
            claimed_globs: ['lib/**'],
          },
        ],
      },
    ],
  }
  const hit = findSessionForTmux(fleet, 'syndcast')
  assert.ok(hit)
  assert.equal(hit.s.session_id, 'abc')
  assert.equal(hit.match, 'tmux')
})

test('findSessionForTmux falls back to worktree basename', () => {
  const fleet = {
    repos: [
      {
        repoId: 'x-bbbbbbbb',
        label: 'x',
        sessions: [
          {
            session_id: 'wt',
            liveness: 'idle',
            worktree: '/home/k/Repositories/mossferry',
            branch: 'main',
          },
        ],
      },
    ],
  }
  const hit = findSessionForTmux(fleet, 'mossferry')
  assert.ok(hit)
  assert.equal(hit.match, 'worktree')
})

test('judgeLineFromBriefs matches session_lines by tmux', () => {
  const briefs = {
    fleet: {
      session_lines: [
        { session_id: 'a', tmux: 'syndcast', text: 'Hot on src/api' },
      ],
      summary: 'desk ok',
    },
    repo: null,
  }
  assert.equal(judgeLineFromBriefs(briefs, { tmuxName: 'syndcast', sessionId: 'a' }), 'Hot on src/api')
  assert.equal(judgeLineFromBriefs(briefs, { tmuxName: 'other' }), '')
})

test('buildSessionLines skips judges and dead', () => {
  const fleet = {
    repos: [
      {
        repoId: 'r-1',
        sessions: [
          {
            session_id: 'w1',
            liveness: 'working',
            branch: 'main',
            tmux: 'app:0',
          },
          {
            session_id: 'j1',
            liveness: 'working',
            role: 'judge',
            branch: 'main',
            tmux: 'judge:0',
          },
          { session_id: 'd1', liveness: 'dead', branch: 'main', tmux: 'dead:0' },
        ],
      },
    ],
  }
  const lines = buildSessionLines(fleet)
  assert.equal(lines.length, 1)
  assert.equal(lines[0].session_id, 'w1')
  assert.equal(lines[0].tmux, 'app')
  assert.match(lines[0].text, /working/)
})

test('aboutTmux not-found is found:false exit-friendly', () => {
  const about = aboutTmux('/tmp/no-such-sage-home-xyz', 'nosuch', {
    fleet: { repos: [] },
    panes: [],
    briefs: { repo: null, fleet: null },
  })
  assert.equal(about.found, false)
  assert.equal(about.kind, 'sage.about')
  assert.equal(about.facts, '')
  assert.match(renderAbout(about), /no session matched/)
})

test('aboutTmux found with facts + judge', () => {
  const fleet = {
    repos: [
      {
        repoId: 'r-1',
        label: 'r',
        sessions: [
          {
            session_id: 'sid1',
            liveness: 'working',
            branch: 'main',
            tmux: 'demo:0',
            claimed_globs: ['a.ts'],
          },
        ],
      },
    ],
  }
  const briefs = {
    fleet: {
      session_lines: [{ session_id: 'sid1', tmux: 'demo', text: 'watch merge' }],
    },
    repo: null,
  }
  const about = aboutTmux('/tmp/x', 'demo', { fleet, panes: [], briefs })
  assert.equal(about.found, true)
  assert.match(about.facts, /working/)
  assert.equal(about.judge, 'watch merge')
  assert.equal(about.role, 'worker')
})
