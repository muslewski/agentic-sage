// Dense single-cell braille "dots" — one column wide, appears to spin in place.
// This mirrors the agentic-sage-website demo's src/demo/spinner.js 1:1 — the
// portable motion spec, the same way lib/color.mjs mirrors highlight.js. Keep
// the two in lockstep so the marketing demo and a real terminal spin identically.
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
export const SPINNER_INTERVAL_MS = 100
