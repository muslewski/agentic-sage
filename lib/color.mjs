// ANSI colorizer for SAGE output. Renderers stay plain-text (so they remain
// testable and pipe-clean); color is applied at the bin/sage print chokepoint.
//
// This mirrors the agentic-sage-website demo's src/demo/highlight.js token rules
// 1:1 — same semantic kinds, same palette intent — so the marketing demo and a
// real terminal render `sage board` identically. Keep the two in lockstep.

import { SPINNER_FRAMES } from './spinner.mjs'

const ANSI = {
  gold: '\x1b[33m', // active / dirty / warnings
  olive: '\x1b[32m', // idle / ●✓✨ / the sage speaking
  cyan: '\x1b[36m', // done / percentages
  red: '\x1b[31m', // dead / closed / ✗
  dim: '\x1b[90m', // paths, meta, separators, calm states
  cream: '\x1b[37m', // session ids, headers
  reset: '\x1b[0m',
}

// line kind → base color for tokens that match no rule (null = terminal default)
function lineBase(line) {
  if (/^(SAGE |usage:)/.test(line)) return 'cream'
  if (/^⚔/u.test(line)) return 'cream' // war-room header line → cream base
  if (/^✨/.test(line)) return 'olive'
  if (/^sage:?\b/.test(line)) return 'cream'
  return null
}

// token → palette key, or null to inherit the line base. First match wins.
function tokenColor(tok) {
  // war-room chrome (these glyphs/words appear only in `sage war`, so the board
  // + website-demo token stream is unaffected — the demo lockstep still holds).
  if (/^⚔/u.test(tok)) return 'gold' // brand glyph
  if (/^(FLEET|ACTIVE|HEAT)$/.test(tok)) return 'cream' // panel titles
  if (/^[╭╮╰╯│─┌┐└┘├┤┬┴┼]+$/u.test(tok)) return 'dim' // box-drawing borders
  if (/^[▁▂▃▄▅▆▇█]+$/u.test(tok)) return 'gold' // heat sparkline
  if (/^(working|active|dirty)$/.test(tok)) return 'gold' // working = real CLI's "doing something" (≡ demo's active)
  if (/^idle$/.test(tok)) return 'olive'
  if (/^done$/.test(tok)) return 'cyan'
  if (/^(dead|closed)$/.test(tok)) return 'red'
  if (/^(clean|none|free)$/.test(tok)) return 'dim'
  if (/^◆$/u.test(tok)) return 'gold' // war-room working glyph (active)
  if (/^[●✓✨]$/u.test(tok)) return 'olive'
  if (/[⚠🟡✎]/u.test(tok)) return 'gold' // warn / uncommitted
  if (/^✗$/u.test(tok)) return 'red'
  if (SPINNER_FRAMES.includes(tok)) return 'gold' // active-row live spinner frame
  if (/^⬜$/u.test(tok)) return 'dim'
  if (/^fresh$/.test(tok)) return 'olive' // handoff buckets
  if (/^(aging|stale)$/.test(tok)) return 'gold'
  if (/^sage:?$/.test(tok)) return 'olive'
  if (/^sesh-/.test(tok)) return 'cream'
  if (/^\d+%$/.test(tok)) return 'cyan'
  if (/^\d+[fmhd]$/.test(tok)) return 'dim'
  if (/^ago$/.test(tok)) return 'dim'
  // dirs (end "/"), globs (have "*"), file paths ("/…​.ext") — NOT branches
  if (/\*/.test(tok) || /\/$/.test(tok) || /\/[^/]*\.\w+$/.test(tok)) return 'dim'
  if (/^[↳•·—@]/u.test(tok)) return 'dim'
  return null
}

export function colorEnabled() {
  if (process.env.NO_COLOR != null) return false
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true
  return Boolean(process.stdout?.isTTY)
}

function paintLine(line) {
  const base = lineBase(line)
  return line
    .split(/(\s+)/)
    .map((p) => {
      if (p === '' || /^\s+$/.test(p)) return p
      const key = tokenColor(p) ?? base
      return key ? `${ANSI[key]}${p}${ANSI.reset}` : p
    })
    .join('')
}

export function paint(text) {
  if (!colorEnabled() || typeof text !== 'string' || !text) return text
  return text.split('\n').map(paintLine).join('\n')
}
