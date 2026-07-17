// ANSI colorizer for SAGE output. Renderers stay plain-text (so they remain
// testable and pipe-clean); color is applied at the bin/sage print chokepoint.
//
// This mirrors the agentic-sage-website demo's src/demo/highlight.js token rules
// 1:1 — same semantic kinds, same palette intent — so the marketing demo and a
// real terminal render `sage board` identically. Keep the two in lockstep.
//
// Phase 5: SEMANTIC paint — state→style for session lead glyphs (live/attention/
// idle/dead). Help/usage prose is never colorized (token-paint false-friends).

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

// Help / usage prose — return identity (zero ANSI). Matches full multi-line
// usage dump and war help overlay titles.
export const isHelpText = (text) => {
  if (typeof text !== 'string' || !text) return false
  if (/^usage:/.test(text)) return true
  if (/^SAGE WAR ROOM — help/m.test(text)) return true
  return false
}

// Semantic row state from a board/war session line. Used to color the lead
// glyph (●/◆) by liveness instead of always-olive.
//   working|active|stalled|compacting → attention (gold)
//   idle                               → live calm (olive)
//   dead|closed                        → terminal (dim lead; status stays red)
//   archive fold                       → dim
export const rowState = (line) => {
  if (/^▸\s*archive\b/u.test(line)) return 'dead'
  // Status tokens appear after the branch id; prefer whole-word matches.
  if (/\b(dead|closed)\b/.test(line)) return 'dead'
  if (/\b(working|active|stalled|compacting|compact)\b/.test(line)) return 'attention'
  if (/\bidle\b/.test(line)) return 'idle'
  return null
}

// line kind → base color for tokens that match no rule (null = terminal default)
function lineBase(line) {
  if (isHelpText(line)) return null
  if (/^▸\s*archive\b/u.test(line)) return 'dim'
  if (/^(SAGE |usage:)/.test(line)) return 'cream'
  if (/^⚔/u.test(line)) return 'cream' // war-room header → cream; face tabs override per-token
  if (/^▌/u.test(line)) return 'cream' // war-room repo band → bright name base
  if (/^❯/u.test(line)) return 'cream' // selected row → bright base (brightens the branch id)
  // Footer: dim base so cream/gold action chips pop (high contrast chrome).
  if (
    /^\s*(↑↓|←→|\/|filter:|manage|clear)/u.test(line) ||
    (/\bhelp\b/.test(line) && /\bquit\b/.test(line)) ||
    /\bfaces\b/.test(line)
  )
    return 'dim'
  if (/^✨/.test(line)) return 'olive'
  if (/^sage:?\b/.test(line)) return 'cream'
  // CLASH path rows — dim base, ⚔/hot tokens paint gold
  if (/^\s+⚔/u.test(line)) return 'dim'
  // Board column headers (BRANCH STATUS ZONE AGE CTX)
  if (/^\s*(CTX|BRANCH)\b/.test(line) && /\b(STATUS|ZONE|AGE)\b/.test(line)) return 'cream'
  // Terminal session rows: dim base so they never read as olive-live.
  const st = rowState(line)
  if (st === 'dead' && /^[●◆] /u.test(line)) return 'dim'
  return null
}

// token → palette key, or null to inherit the line base. First match wins.
// `state` is the semantic rowState for lead-glyph overrides.
function tokenColor(tok, state = null) {
  // war-room chrome (these glyphs/words appear only in `sage war`, so the board
  // + website-demo token stream is unaffected — the demo lockstep still holds).
  if (/^⚔/u.test(tok)) return 'gold' // brand glyph + clash path lead
  if (/^▌$/u.test(tok)) return 'gold' // repo-band accent bar
  if (/^❯$/u.test(tok)) return 'gold' // war-room selection cursor
  // Face tabs (horizontal nav): ACTIVE = gold pop, inactive = dim, brackets dim.
  if (/^(LIVE|CLASH|MEMORY)$/.test(tok)) return 'gold' // active face (UPPER)
  if (/^(live|clash|memory)$/.test(tok)) return 'dim' // inactive face (lower)
  if (/^[‹›]$/u.test(tok)) return 'dim' // tab brackets
  // Footer / chrome motion keys — gold so navigation reads instantly
  if (/^(↑↓|←→)$/u.test(tok)) return 'gold'
  if (/^↵$/u.test(tok)) return 'gold'
  if (/^\/$/.test(tok)) return 'gold' // filter key
  if (/^[1-3]$/.test(tok)) return 'gold' // face jump keys when alone (help)
  // Footer action words (cream on dim base = readable labels)
  if (/^(move|open|filter|help|quit|faces|manage|zone|work|nest|all|hottest)$/.test(tok))
    return 'cream'
  if (/^(zone✓|work✓|nest✓|all✓)$/u.test(tok)) return 'olive' // active toggles
  if (/^clear×\d+$/u.test(tok)) return 'gold' // MEMORY bulk clear CTA
  if (/^2→clash$/u.test(tok)) return 'gold' // LIVE → jump CLASH hint
  if (/^gen$/i.test(tok)) return 'gold' // generated path tag on CLASH
  if (/^\d+hot$/u.test(tok)) return 'gold' // ·2hot severity chip
  if (/^PATHS$/u.test(tok)) return 'cream' // clash column strip title
  if (/^hot$/.test(tok)) return 'gold' // HEAT panel + repo-band working rollup
  if (/^compact$/.test(tok)) return 'gold' // HEAT compacting face
  if (/^(clear|ghosts|churn|terminal|records|only|good)$/.test(tok)) return 'dim'
  if (/^(FLEET|ACTIVE|HEAT|INVOLVED|ARCHIVE|CLEAN|HEALTH|RISK)$/.test(tok)) return 'cream' // panel / banner titles
  if (/^(low|medium|high)$/.test(tok)) return tok === 'high' ? 'red' : tok === 'medium' ? 'gold' : 'olive'
  if (/^orphans?$/i.test(tok)) return 'dim'
  // CLASH/MEMORY panel titles share names with faces — keep cream for panel chrome
  // (line starts with ╭ not ⚔, so face-tab gold rule already ran only for exact LIVE etc.)
  if (/^(SESSION|STATUS|ZONE|HANDOFF|NAME|BRANCH|AGE|CTX)$/.test(tok)) return 'cream' // column headers
  if (/^[╭╮╰╯│─┌┐└┘├┤┬┴┼]+$/u.test(tok)) return 'dim' // box-drawing borders
  if (/^[▁▂▃▄▅▆▇█]+$/u.test(tok)) return 'gold' // heat sparkline
  // Block gauges (board CTX): mix of █ and ░ — cyan like percentages.
  if (/^[█░]+$/u.test(tok)) return 'cyan'
  if (/^(working|active|dirty)$/.test(tok)) return 'gold' // working = real CLI's "doing something" (≡ demo's active)
  if (/^idle$/.test(tok)) return 'olive'
  if (/^stalled$/.test(tok)) return 'gold'
  if (/^compacting$/.test(tok)) return 'gold'
  if (/^done$/.test(tok)) return 'cyan'
  if (/^(dead|closed)$/.test(tok)) return 'red'
  if (/^(clean|none|free)$/.test(tok)) return 'dim'
  if (/^◆$/u.test(tok)) return 'gold' // war-room working glyph (active)
  // Semantic lead ● — state wins over always-olive.
  if (/^●$/u.test(tok)) {
    if (state === 'dead') return 'dim'
    if (state === 'attention') return 'gold'
    if (state === 'idle') return 'olive'
    return 'olive' // default calm live
  }
  if (/^[✓✨]$/u.test(tok)) return 'olive'
  if (/[⚠🟡✎]/u.test(tok)) return 'gold' // warn / uncommitted
  if (/^✗$/u.test(tok)) return 'red'
  if (SPINNER_FRAMES.includes(tok)) return 'gold' // active-row live spinner frame
  if (/^⬜$/u.test(tok)) return 'dim'
  if (/^▸$/u.test(tok)) return 'dim' // archive fold marker
  if (/^archive$/.test(tok)) return 'dim'
  if (/^fresh$/.test(tok)) return 'olive' // handoff buckets
  if (/^(aging|stale)$/.test(tok)) return 'gold'
  if (/^sage:?$/.test(tok)) return 'olive'
  if (/^sesh-/.test(tok)) return 'cream'
  if (/^\d+%$/.test(tok)) return 'cyan'
  // Face-tab counts (e.g. LIVE 12 · clash 1) and AGE cells like 4m / 1h
  if (/^\d+[fmhd]$/.test(tok)) return 'dim'
  if (/^ago$/.test(tok)) return 'dim'
  // Pure numbers: cyan on header (tab counts); dim elsewhere unless overridden
  // Handled in paintLine with line context — see below via tokenColorCtx
  // dirs (end "/"), globs (have "*"), file paths ("/…​.ext") — NOT branches
  if (/\*/.test(tok) || /\/$/.test(tok) || /\/[^/]*\.\w+$/.test(tok)) return 'dim'
  if (/^[↳•·—@]$/u.test(tok)) return 'dim'
  if (/^·\d+$/u.test(tok)) return 'gold' // ·3 session count on clash path
  return null
}

// Context-aware token color (header counts, footer numbers).
function tokenColorCtx(tok, line, state) {
  const hit = tokenColor(tok, state)
  if (hit) return hit
  if (/^\d+$/.test(tok)) {
    // Tab bar counts on war header
    if (/^⚔/u.test(line)) {
      const n = Number(tok)
      if (n === 0) return 'dim'
      // Large piles (MEMORY) read as archive pressure → still cyan (info), gold only for small clash
      return 'cyan'
    }
    // Footer clash path counts / clear×N already matched; bare digits dim
    if (/\bfaces\b/.test(line) || /\bhelp\b/.test(line)) return 'cyan'
  }
  return null
}

export function colorEnabled() {
  if (process.env.NO_COLOR != null) return false
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true
  return Boolean(process.stdout?.isTTY)
}

function paintLine(line) {
  if (isHelpText(line)) return line
  const base = lineBase(line)
  const state = rowState(line)
  return line
    .split(/(\s+)/)
    .map((p) => {
      if (p === '' || /^\s+$/.test(p)) return p
      const key = tokenColorCtx(p, line, state) ?? base
      return key ? `${ANSI[key]}${p}${ANSI.reset}` : p
    })
    .join('')
}

export function paint(text) {
  if (!colorEnabled() || typeof text !== 'string' || !text) return text
  // Whole multi-line help/usage dumps stay uncolored (s3).
  if (isHelpText(text)) return text
  return text.split('\n').map(paintLine).join('\n')
}
