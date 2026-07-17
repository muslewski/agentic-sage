import { test } from 'node:test'
import assert from 'node:assert/strict'

// paint() reads env at call time, so set FORCE_COLOR before importing-safe use.
import { paint } from '../lib/color.mjs'

const withEnv = (env, fn) => {
  const saved = {}
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] == null) delete process.env[k]; else process.env[k] = env[k] }
  try { return fn() } finally {
    for (const k of Object.keys(env)) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k] }
  }
}

test('NO_COLOR disables coloring (output is identity)', () => {
  withEnv({ NO_COLOR: '1', FORCE_COLOR: null }, () => {
    assert.equal(paint('sesh-12  active  src/auth/**'), 'sesh-12  active  src/auth/**')
  })
})

test('FORCE_COLOR wraps status words in ANSI', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const out = paint('sesh-12  active  done  dead')
    assert.match(out, /\x1b\[33mactive\x1b\[0m/) // gold
    assert.match(out, /\x1b\[36mdone\x1b\[0m/) // cyan
    assert.match(out, /\x1b\[31mdead\x1b\[0m/) // red
  })
})

test('coloring preserves the plain text when stripped of ANSI', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const line = 'SAGE board · acme-web · 3 session(s)'
    const stripped = paint(line).replace(/\x1b\[[0-9;]*m/g, '')
    assert.equal(stripped, line)
  })
})

test('the real CLI "working" status word is painted gold', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    assert.match(paint('● feat/a  working · 71%  src/a/'), /\x1b\[33mworking\x1b\[0m/)
  })
})

test('an active-row spinner frame is painted gold', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const out = paint('⠋ feat/a  active  src/a/')
    assert.match(out, /\x1b\[33m⠋\x1b\[0m/) // gold spinner frame
  })
})

test('war-room chrome is skinned: ⚔ gold, borders dim, titles cream, spark gold', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    assert.match(paint('⚔  SAGE WAR ROOM'), /\x1b\[33m⚔\x1b\[0m/) // gold brand glyph
    assert.match(paint('╭─ FLEET ──────╮'), /\x1b\[90m╭─\x1b\[0m/) // dim border run
    assert.match(paint('╭─ FLEET ──────╮'), /\x1b\[37mFLEET\x1b\[0m/) // cream panel title
    assert.match(paint('│ ▂▃▅▇█  2 hot │'), /\x1b\[33m▂▃▅▇█\x1b\[0m/) // gold heat sparkline
  })
})

test('war-room repo band: ▌ bar gold, name cream, hot rollup gold', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    assert.match(paint('▌ llm-armory · 22 sessions'), /\x1b\[33m▌\x1b\[0m/) // gold accent bar
    assert.match(paint('▌ llm-armory · 22 sessions'), /\x1b\[37mllm-armory\x1b\[0m/) // cream name
    assert.match(paint('▌ syndcast · 3 sessions   · 2 hot'), /\x1b\[33mhot\x1b\[0m/) // gold rollup
  })
})

test('war-room selection cursor ❯ is painted gold', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    assert.match(paint('❯ ● main  working'), /\x1b\[33m❯\x1b\[0m/) // gold cursor
  })
})

test('multiline text is colorized per line', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const out = paint('SAGE doctor\n  ✓ sage home — ok\n  ✗ broken — bad')
    assert.match(out, /\x1b\[32m✓\x1b\[0m/) // olive check
    assert.match(out, /\x1b\[31m✗\x1b\[0m/) // red cross
  })
})

test('paint: war column-header labels are cream; a lone │ rule is dim', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const CREAM = '\x1b[37m'
    const DIM = '\x1b[90m'
    const line = paint('    SESSION                    │ STATUS         │ ZONE')
    assert.ok(line.includes(`${CREAM}SESSION\x1b[0m`), 'SESSION painted cream')
    assert.ok(line.includes(`${CREAM}STATUS\x1b[0m`), 'STATUS painted cream')
    assert.ok(line.includes(`${DIM}│\x1b[0m`), 'rule painted dim')
  })
})

test('paint: face tabs — active gold, inactive dim; counts cyan on header', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const GOLD = '\x1b[33m'
    const DIM = '\x1b[90m'
    const CYAN = '\x1b[36m'
    const hdr = paint('⚔  SAGE WAR     ‹ LIVE 12 · clash 1 · memory 600 ›     12:00:00')
    assert.ok(hdr.includes(`${GOLD}LIVE\x1b[0m`), 'active LIVE gold')
    assert.ok(hdr.includes(`${DIM}clash\x1b[0m`), 'inactive clash dim')
    assert.ok(hdr.includes(`${DIM}memory\x1b[0m`), 'inactive memory dim')
    assert.ok(hdr.includes(`${CYAN}12\x1b[0m`), 'live count cyan')
    assert.ok(hdr.includes(`${DIM}‹\x1b[0m`) || hdr.includes('‹'), 'brackets present')
  })
})

test('paint: footer — dim base, cream labels, gold motion keys', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const GOLD = '\x1b[33m'
    const CREAM = '\x1b[37m'
    const foot = paint(' ↑↓ move · ↵ open · / filter · zone✓ · ←→ faces · ? help · q quit')
    assert.ok(foot.includes(`${GOLD}↑↓\x1b[0m`), '↑↓ gold')
    assert.ok(foot.includes(`${GOLD}←→\x1b[0m`), '←→ gold')
    assert.ok(foot.includes(`${CREAM}move\x1b[0m`), 'move cream')
    assert.ok(foot.includes(`${CREAM}help\x1b[0m`), 'help cream')
    assert.ok(foot.includes(`${CREAM}faces\x1b[0m`), 'faces cream')
  })
})

test('paint: MEMORY clear CTA and CLASH path lead', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const GOLD = '\x1b[33m'
    assert.ok(paint(' X clear×600 · m manage · ←→ faces · ? help · q quit').includes(`${GOLD}clear×600\x1b[0m`))
    assert.ok(paint('  ⚔ lib/warroom.mjs  ·2 1hot').includes(`${GOLD}⚔\x1b[0m`))
  })
})

// ── Phase 5 Child A: semantic paint + help uncolored (s3) ──

test('s3: paint maps session states semantically (live/attention/idle/dead)', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const GOLD = '\x1b[33m'
    const OLIVE = '\x1b[32m'
    const RED = '\x1b[31m'
    const DIM = '\x1b[90m'

    // working / attention → gold lead, not olive-live on a hot row
    const work = paint('● feat/a  working · 71%  src/a/  4m')
    assert.ok(work.includes(`${GOLD}●\x1b[0m`) || work.includes(`${GOLD}working\x1b[0m`), 'working state gold')

    // idle → olive lead (calm live)
    const idle = paint('● feat/b  idle  src/b/  1h')
    assert.ok(idle.includes(`${OLIVE}●\x1b[0m`) || idle.includes(`${OLIVE}idle\x1b[0m`), 'idle olive')

    // dead row → ● is NOT olive (the audit bug); dim or red
    const dead = paint('● main  dead  3d')
    assert.ok(!dead.includes(`${OLIVE}●\x1b[0m`), 'dead ● must not be olive')
    assert.ok(
      dead.includes(`${DIM}●\x1b[0m`) || dead.includes(`${RED}●\x1b[0m`) || dead.includes(`${RED}dead\x1b[0m`),
      'dead painted dim/red',
    )

    // archive fold → dim
    const fold = paint('▸ archive (80)')
    assert.ok(fold.includes(`${DIM}`) || fold === '▸ archive (80)', 'archive fold dim or plain')
    const stripped = fold.replace(/\x1b\[[0-9;]*m/g, '')
    assert.equal(stripped, '▸ archive (80)')
  })
})

test('s3: help/usage prose contains zero color codes', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const usage = `usage: sage <command>   (for Claude Code, Grok Build CLI, and other AI agents)
  board [--watch] [--wide|-w] [--json]   roster of this repo's sessions (--watch = live)
  war [--json] [--wide|-w] [--all]       live cross-repo fleet cockpit; ? help · X clear dead
  fleet [--json]                         one-line nearest-neighbour summary`

    const out = paint(usage)
    assert.equal(out, usage, 'usage must be identity under FORCE_COLOR')
    assert.ok(!/\x1b\[/.test(out), 'zero ANSI in help')

    // false-friend words must NOT be recolored when inside usage
    assert.ok(!out.includes('\x1b[90mlive\x1b[0m'))
    assert.ok(!out.includes('\x1b[31mdead\x1b[0m'))
  })
})

test('s3: war help overlay prose is uncolored', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const help = `SAGE WAR ROOM — help

Three faces (← →): LIVE army · CLASH contests · MEMORY graveyard.

  ← →  [ ]     switch face: LIVE · CLASH · MEMORY
Press ?  h  or  esc  to close`
    const out = paint(help)
    assert.equal(out, help)
  })
})

test('s3: column headers stay cream; gauge blocks inherit status color path', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const CREAM = '\x1b[37m'
    const hdr = paint('  CTX    STATUS     BRANCH          ZONE        AGE')
    assert.ok(hdr.includes(`${CREAM}STATUS\x1b[0m`) || hdr.includes(`${CREAM}BRANCH\x1b[0m`))
    // block gauge paints (cyan like % or gold for heat)
    const gauge = paint('● feat  ████░ working · 80%  lib/  4m')
    assert.match(gauge, /\x1b\[[0-9;]*m/)
  })
})
