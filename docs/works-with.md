---
title: "Works with"
description: "How agentic-sage fits the muslewski fleet — real interop, not a laundry list."
section: recipes
order: 5
---

# Works with

SAGE is the **fleet judge**. Sibling tools cover other slices of the same desk. Name them in feature docs when a **real** integration exists; this page is the short map.

| Package | Relationship to SAGE | Links |
|---------|----------------------|--------|
| **status-herald** | Curtain cards / status bars for agent panes. Compact/COMPACTING and session truth can line up with SAGE’s read-only fleet view. See also in-repo interop note. | [herald.muslewski.com](https://herald.muslewski.com) · [npm](https://www.npmjs.com/package/status-herald) · [interop](./interop-status-herald.md) |
| **token-oracle** | Offline token/cap forecasts. SAGE can point `tokenForecastPath` at an oracle (or legacy) forecast feed for optional statusline / board context — see [statusline recipe](./recipes/statusline.md). | [oracle.muslewski.com](https://oracle.muslewski.com) · [npm](https://www.npmjs.com/package/token-oracle) |
| **memory-atlas** | Code-verified architecture vaults. This repo’s understanding lives in `agentic-sage-mind/` (Atlas); public guides live in `docs/`. Recollection keeps both honest. | [atlas.muslewski.com](https://atlas.muslewski.com) · [npm](https://www.npmjs.com/package/memory-atlas) |
| **llm-armory** | Named executor loadouts (advisor → Grok children). Sessions armory spawns are still **judged**, not orchestrated, by SAGE when hooks are on. | [armory.muslewski.com](https://armory.muslewski.com) · [npm](https://www.npmjs.com/package/llm-armory) |
| **mossferry** | Remote tmux/mosh “ferry” to the machine where your fleet actually runs. SAGE lives on the **app host** (often Manjaro); ferry is how you get there from a laptop. | [mossferry.muslewski.com](https://mossferry.muslewski.com) · [npm](https://www.npmjs.com/package/mossferry) |

## Rules for authors

1. **Contextual first** — when documenting a feature that displays or depends on a sibling, say so in that page (one clear sentence + link).
2. **Update this table** when you add or remove a real edge.
3. **Do not invent** — if code does not wire it, do not claim it.

## See also

- [Statusline recipe](./recipes/statusline.md)
- [Multi-harness recipe](./recipes/multi-harness.md)
- [Getting started](./getting-started.md)
