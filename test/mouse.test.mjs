import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMouseEvents,
  MOUSE_ENABLE,
  MOUSE_DISABLE,
} from '../lib/mouse.mjs'

test('MOUSE_ENABLE / DISABLE are SGR button-tracking sequences', () => {
  assert.equal(MOUSE_ENABLE, '\x1b[?1000h\x1b[?1006h')
  assert.equal(MOUSE_DISABLE, '\x1b[?1000l\x1b[?1006l')
})

test('wheel up (b=64, M) and wheel down (b=65, M)', () => {
  const up = parseMouseEvents('\x1b[<64;10;5M')
  assert.deepEqual(up.events, [{ type: 'wheel-up', button: 64, x: 10, y: 5 }])
  assert.equal(up.rest, '')
  assert.equal(up.pending, '')

  const down = parseMouseEvents('\x1b[<65;1;1M')
  assert.deepEqual(down.events, [{ type: 'wheel-down', button: 65, x: 1, y: 1 }])
  assert.equal(down.rest, '')
})

test('left-button press (b=0, M) is click; release (m) is ignored', () => {
  const press = parseMouseEvents('\x1b[<0;3;12M')
  assert.deepEqual(press.events, [{ type: 'click', button: 0, x: 3, y: 12 }])
  assert.equal(press.rest, '')

  const release = parseMouseEvents('\x1b[<0;3;12m')
  assert.deepEqual(release.events, [])
  assert.equal(release.rest, '')
  assert.equal(release.pending, '')
})

test('other buttons / motion codes are consumed, not emitted, not rest', () => {
  // right press b=2, middle b=1, drag with motion bit, etc.
  for (const seq of ['\x1b[<2;1;1M', '\x1b[<1;5;5M', '\x1b[<32;8;8M', '\x1b[<66;1;1M']) {
    const r = parseMouseEvents(seq)
    assert.deepEqual(r.events, [], seq)
    assert.equal(r.rest, '', seq)
    assert.equal(r.pending, '', seq)
  }
})

test('multiple events in one buffer', () => {
  const r = parseMouseEvents('\x1b[<64;1;1M\x1b[<65;2;2M\x1b[<0;3;3M')
  assert.deepEqual(
    r.events.map((e) => e.type),
    ['wheel-up', 'wheel-down', 'click'],
  )
  assert.equal(r.rest, '')
})

test('keyboard bytes interleave: mouse stripped, rest preserved', () => {
  const r = parseMouseEvents('a\x1b[<64;1;1Mj\x1b[<0;2;3M\x03')
  assert.deepEqual(
    r.events.map((e) => e.type),
    ['wheel-up', 'click'],
  )
  assert.equal(r.rest, 'aj\x03')
  assert.equal(r.pending, '')
})

test('arrow / CSI keys pass through as rest (not mistaken for mouse)', () => {
  for (const k of ['\x1b[A', '\x1b[B', '\x1b[C', '\x1b[D', '\x1b[5~', '\x1b[6~', '\x1b']) {
    const r = parseMouseEvents(k)
    assert.deepEqual(r.events, [], k)
    assert.equal(r.rest, k, k)
    assert.equal(r.pending, '', k)
  }
})

test('truncated SGR prefix is held as pending, not rest (no letter fall-through)', () => {
  const cases = [
    '\x1b[<',
    '\x1b[<0',
    '\x1b[<0;',
    '\x1b[<0;1',
    '\x1b[<0;1;',
    '\x1b[<0;1;2',
    '\x1b[<64;10;5',
  ]
  for (const p of cases) {
    const r = parseMouseEvents(p)
    assert.deepEqual(r.events, [], p)
    assert.equal(r.rest, '', p)
    assert.equal(r.pending, p, p)
  }
})

test('prefix + completion across two parse calls', () => {
  const a = parseMouseEvents('\x1b[<0;4;8')
  assert.equal(a.pending, '\x1b[<0;4;8')
  assert.equal(a.rest, '')
  const b = parseMouseEvents(a.pending + 'M')
  assert.deepEqual(b.events, [{ type: 'click', button: 0, x: 4, y: 8 }])
  assert.equal(b.rest, '')
  assert.equal(b.pending, '')
})

test('keys before a truncated mouse prefix: keys in rest, prefix pending', () => {
  const r = parseMouseEvents('q\x1b[<65;1;')
  assert.equal(r.rest, 'q')
  assert.equal(r.pending, '\x1b[<65;1;')
  assert.deepEqual(r.events, [])
})

test('invalid after \\x1b[< is discarded (not rest), never throws', () => {
  const r = parseMouseEvents('\x1b[<abc\x1b[<0;1;2Mx')
  assert.deepEqual(r.events, [{ type: 'click', button: 0, x: 1, y: 2 }])
  // invalid attempt consumed; trailing keyboard remains
  assert.equal(r.rest, 'x')
  assert.equal(r.pending, '')
})

test('empty / non-string-ish is safe', () => {
  assert.deepEqual(parseMouseEvents(''), { events: [], rest: '', pending: '' })
  assert.deepEqual(parseMouseEvents(null), { events: [], rest: '', pending: '' })
  assert.deepEqual(parseMouseEvents(undefined), { events: [], rest: '', pending: '' })
})

test('large coords (SGR extended) parse fine', () => {
  const r = parseMouseEvents('\x1b[<0;200;150M')
  assert.deepEqual(r.events, [{ type: 'click', button: 0, x: 200, y: 150 }])
})
