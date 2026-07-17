// SGR (1006) mouse tracking helpers for the hand-rolled raw-mode watch TUIs
// (`sage war`, `sage board --watch`). Pure parse — no I/O. Terminal enable /
// disable sequences live here so enable and teardown never drift apart.
//
// Protocol (xterm):
//   enable  CSI ? 1000 h  (button tracking) + CSI ? 1006 h  (SGR coords)
//   disable CSI ? 1000 l  + CSI ? 1006 l
//   event   CSI < b ; x ; y M   press / wheel   (final M)
//           CSI < b ; x ; y m   release         (final m)
// Button codes we care about (press/wheel only, final M):
//   0  left click   64 wheel-up   65 wheel-down
// Everything else (releases, drag/motion, other buttons) is consumed and dropped
// so it never falls through into letter-key handling.

export const MOUSE_ENABLE = '\x1b[?1000h\x1b[?1006h'
export const MOUSE_DISABLE = '\x1b[?1000l\x1b[?1006l'

// Complete SGR mouse event: ESC [ < b ; x ; y M|m
const SGR_EVENT = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/

// A trailing incomplete prefix of an SGR mouse event (digits/semicolons only).
// Must not match bare ESC / CSI arrows — only the distinctive ESC [ < start.
const SGR_PREFIX = /^\x1b\[<\d*(?:;\d*){0,2}$/

const eventOf = (button, x, y, final) => {
  // Releases never produce actions.
  if (final !== 'M') return null
  if (button === 64) return { type: 'wheel-up', button, x, y }
  if (button === 65) return { type: 'wheel-down', button, x, y }
  if (button === 0) return { type: 'click', button, x, y }
  return null
}

// Parse one stdin chunk (optionally prefixed with a previous `pending`).
// Returns:
//   events  — actionable wheel/click events in order
//   rest    — non-mouse bytes for the key handler (never a truncated SGR prefix)
//   pending — incomplete trailing SGR prefix to prepend on the next chunk
export const parseMouseEvents = (buf) => {
  const s = buf == null ? '' : String(buf)
  const events = []
  let rest = ''
  let i = 0
  while (i < s.length) {
    // Distinctive SGR start: ESC [ <
    if (s.charCodeAt(i) === 0x1b && s.startsWith('[<', i + 1)) {
      const tail = s.slice(i)
      const m = tail.match(SGR_EVENT)
      if (m) {
        const button = Number(m[1])
        const x = Number(m[2])
        const y = Number(m[3])
        const final = m[4]
        const ev = eventOf(button, x, y, final)
        if (ev) events.push(ev)
        i += m[0].length
        continue
      }
      // Incomplete valid prefix at end of buffer → hold (do not key-handle).
      if (SGR_PREFIX.test(tail)) {
        return { events, rest, pending: tail }
      }
      // Invalid after ESC [ < — discard the broken attempt so it never becomes
      // letter keys. Stop at next ESC (exclusive) or after a stray M/m.
      let j = i + 1
      while (j < s.length && s.charCodeAt(j) !== 0x1b) {
        j += 1
        if (s[j - 1] === 'M' || s[j - 1] === 'm') break
      }
      i = j
      continue
    }
    rest += s[i]
    i += 1
  }
  return { events, rest, pending: '' }
}
