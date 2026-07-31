---
type: tech-debt
summary: "Sage Island heat badge is 0 unless merge-brief emits stable machine JSON for contested path count — avoid scraping TTY in the UI."
status: open
created: 2026-07-31
updated: 2026-07-31
related:
  - "[[desktop-island]]"
  - "[[judge-surface]]"
---

# Island heat depends on merge-brief machine JSON

v1 island prefers real `sage merge-brief --json` contested counts. If the CLI
emits human text or an envelope without a clear contested length field, heat
stays **0** rather than inventing overlap math in the desktop app.

**Fix later:** ensure merge-brief JSON exposes a stable contested count (or reuse
an existing field the island can read without scraping), then wire `fetchHeat`
to it end-to-end.
