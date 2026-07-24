import test from 'node:test'
import assert from 'node:assert/strict'
import {
  factsLine,
  topicFingerprint,
  tmuxSessionOfPane,
  findSessionForTmux,
  judgeLineFromBriefs,
  sessionLineStillRelevant,
  buildSessionLines,
  stampSessionLineFingerprints,
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

test('topicFingerprint changes on claim/window pivot', () => {
  const a = {
    branch: 'dogfood/a',
    window_name: 'auth-login',
    claimed_globs: ['lib/auth/**'],
  }
  const b = {
    branch: 'dogfood/a',
    window_name: 'payments-api',
    claimed_globs: ['lib/payments/**'],
  }
  assert.notEqual(topicFingerprint(a), topicFingerprint(b))
  assert.equal(topicFingerprint(a), topicFingerprint({ ...a, claimed_globs: ['lib/auth/**'] }))
})

test('sessionLineStillRelevant: fingerprint mismatch → false', () => {
  const s = {
    branch: 'main',
    window_name: 'payments-api',
    claimed_globs: ['lib/payments/**'],
    liveness: 'idle',
  }
  const liveFacts = factsLine(s)
  const oldFp = topicFingerprint({
    branch: 'main',
    window_name: 'auth-login',
    claimed_globs: ['lib/auth/**'],
  })
  assert.equal(
    sessionLineStillRelevant(
      { text: 'old auth work', fingerprint: oldFp },
      s,
      liveFacts,
    ),
    false,
  )
  assert.equal(
    sessionLineStillRelevant(
      { text: 'payments narrative', fingerprint: topicFingerprint(s) },
      s,
      liveFacts,
    ),
    true,
  )
})

test('sessionLineStillRelevant: facts clone → false', () => {
  const s = { liveness: 'idle', branch: 'main', claimed_globs: ['x/**'], window_name: 'w' }
  const facts = factsLine(s)
  assert.equal(
    sessionLineStillRelevant({ text: facts, fingerprint: topicFingerprint(s) }, s, facts),
    false,
  )
})

test('judgeLineFromBriefs drops stale fingerprint', () => {
  const s = {
    session_id: 'dog-a',
    branch: 'main',
    window_name: 'payments-api',
    claimed_globs: ['lib/payments/**'],
    liveness: 'idle',
  }
  const oldFp = topicFingerprint({
    branch: 'main',
    window_name: 'auth-login',
    claimed_globs: ['lib/auth/**'],
  })
  const briefs = {
    fleet: {
      session_lines: [
        {
          session_id: 'dog-a',
          tmux: 'sage-dog-a',
          text: 'still on auth',
          fingerprint: oldFp,
        },
      ],
    },
    repo: null,
  }
  assert.equal(
    judgeLineFromBriefs(briefs, {
      sessionId: 'dog-a',
      tmuxName: 'sage-dog-a',
      s,
      liveFacts: factsLine(s),
    }),
    '',
  )
})

test('judgeLineFromBriefs keeps matching narrative', () => {
  const s = {
    session_id: 'dog-a',
    branch: 'main',
    window_name: 'payments-api',
    claimed_globs: ['lib/payments/**'],
    liveness: 'idle',
  }
  const briefs = {
    fleet: {
      session_lines: [
        {
          session_id: 'dog-a',
          tmux: 'sage-dog-a',
          text: 'Pivoted → payments',
          fingerprint: topicFingerprint(s),
        },
      ],
    },
    repo: null,
  }
  assert.equal(
    judgeLineFromBriefs(briefs, {
      sessionId: 'dog-a',
      tmuxName: 'sage-dog-a',
      s,
      liveFacts: factsLine(s),
    }),
    'Pivoted → payments',
  )
})

test('buildSessionLines stamps fingerprint', () => {
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
            claimed_globs: ['src/**'],
            window_name: 'work',
          },
        ],
      },
    ],
  }
  const lines = buildSessionLines(fleet)
  assert.equal(lines.length, 1)
  assert.ok(lines[0].fingerprint)
  assert.equal(lines[0].fingerprint, topicFingerprint(fleet.repos[0].sessions[0]))
})

test('stampSessionLineFingerprints fills missing fp', () => {
  const s = {
    session_id: 'w1',
    liveness: 'working',
    branch: 'main',
    tmux: 'app:0',
    claimed_globs: ['src/**'],
    window_name: 'work',
  }
  const fleet = { repos: [{ repoId: 'r', sessions: [s] }] }
  const stamped = stampSessionLineFingerprints(
    [{ session_id: 'w1', tmux: 'app', text: 'doing src' }],
    fleet,
  )
  assert.equal(stamped[0].fingerprint, topicFingerprint(s))
})

test('aboutTmux: after pivot, stale judge line hidden', () => {
  const sLive = {
    session_id: 'sid1',
    liveness: 'working',
    branch: 'main',
    tmux: 'demo:0',
    claimed_globs: ['lib/payments/**'],
    window_name: 'payments-api',
  }
  const fleet = {
    repos: [{ repoId: 'r-1', label: 'r', sessions: [sLive] }],
  }
  const oldFp = topicFingerprint({
    branch: 'main',
    window_name: 'auth-login',
    claimed_globs: ['lib/auth/**'],
  })
  const briefs = {
    fleet: {
      session_lines: [
        {
          session_id: 'sid1',
          tmux: 'demo',
          text: 'auth focus',
          fingerprint: oldFp,
        },
      ],
    },
    repo: null,
  }
  const about = aboutTmux('/tmp/x', 'demo', { fleet, panes: [], briefs })
  assert.equal(about.found, true)
  assert.match(about.facts, /payments/)
  assert.equal(about.judge, '', 'stale judge must be empty after topic pivot')
})

test('aboutTmux: narrative with matching fp shows; facts clone hidden', () => {
  const sLive = {
    session_id: 'sid1',
    liveness: 'working',
    branch: 'main',
    tmux: 'demo:0',
    claimed_globs: ['lib/payments/**'],
    window_name: 'payments-api',
  }
  const fleet = {
    repos: [{ repoId: 'r-1', label: 'r', sessions: [sLive] }],
  }
  const fp = topicFingerprint(sLive)
  const facts = factsLine(sLive)
  const briefsClone = {
    fleet: {
      session_lines: [{ session_id: 'sid1', tmux: 'demo', text: facts, fingerprint: fp }],
    },
    repo: null,
  }
  const aboutClone = aboutTmux('/tmp/x', 'demo', { fleet, panes: [], briefs: briefsClone })
  assert.equal(aboutClone.judge, '', 'facts clone must not appear as judge')

  const briefsNarr = {
    fleet: {
      session_lines: [
        {
          session_id: 'sid1',
          tmux: 'demo',
          text: 'Pivoted → payments/billing',
          fingerprint: fp,
        },
      ],
    },
    repo: null,
  }
  const aboutNarr = aboutTmux('/tmp/x', 'demo', { fleet, panes: [], briefs: briefsNarr })
  assert.equal(aboutNarr.judge, 'Pivoted → payments/billing')
  assert.match(renderAbout(aboutNarr), /⚖/)
})

test('tmuxSessionOfPane splits session:window', () => {
  assert.equal(tmuxSessionOfPane('syndcast:0'), 'syndcast')
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
})
