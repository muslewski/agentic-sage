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
| **memory-atlas** | **Dual superpower with SAGE.** Atlas holds the **past / architecture present** of a repo (code-verified zone cards + frozen decisions/specs). SAGE holds the **session present** of the desk (who is live, territory, merge risk). File-only coupling: optional project adapter reads `atlas.config.json` + zone globs so board/territory show zone names and treat `map/index.md` as generated. This repo’s mind is `agentic-sage-mind/`; public product prose stays in `docs/`. Neither package imports the other at runtime. | [atlas.muslewski.com](https://atlas.muslewski.com) · [npm](https://www.npmjs.com/package/memory-atlas) · [SETUP](../SETUP.md) · [desk fleet](./recipes/desk-fleet.md) |
| **llm-armory** | Named executor loadouts (advisor → Grok children). Sessions armory spawns are still **judged**, not orchestrated, by SAGE when hooks are on. | [armory.muslewski.com](https://armory.muslewski.com) · [npm](https://www.npmjs.com/package/llm-armory) |
| **mossferry** | Remote tmux/mosh “ferry” to the machine where your fleet actually runs. **Optional wire:** ferry calls `sage about --tmux` for picker preview one-liners and can spawn **`sage judge run`** via ⚖ new judge… when sage is on PATH (`FERRY_SAGE=auto` on the ferry side). Fact judge run auto-fills brief `session_lines`. | [mossferry.muslewski.com](https://mossferry.muslewski.com) · [npm](https://www.npmjs.com/package/mossferry) |

## Dual superpower — past vs present

| Tense | Tool | Answers |
|-------|------|---------|
| **Architecture past + map present** | [memory-atlas](https://atlas.muslewski.com) | What is this code *supposed* to be? Which zones own which globs? What did we decide and when was it last verified? |
| **Session present** | **SAGE** (this package) | Who is working *right now*? Which paths collide? What should a merge-brief say before I open a PR? |

Wire SAGE first with the linear checklist in **[`SETUP.md`](../SETUP.md)** (required → recommended → optional). Add a vault with Atlas when you want architecture memory that survives sessions — `atlas init` / `atlas wire` in that repo, then optionally drop the [with-agentic-sage adapter](https://github.com/muslewski/memory-atlas/tree/main/examples/with-agentic-sage) so territory speaks zone names.

Hands-on multi-repo path: [Wire a multi-repo desk](./recipes/desk-fleet.md).

## Rules for authors

1. **Contextual first** — when documenting a feature that displays or depends on a sibling, say so in that page (one clear sentence + link).
2. **Update this table** when you add or remove a real edge.
3. **Do not invent** — if code does not wire it, do not claim it.

## See also

- [Statusline recipe](./recipes/statusline.md)
- [Multi-harness recipe](./recipes/multi-harness.md)
- [Desk fleet recipe](./recipes/desk-fleet.md)
- [Getting started](./getting-started.md)
- [SETUP.md](../SETUP.md) — full human bootstrap


## Past + present

| Layer | Package | Install | Soft health |
|-------|---------|---------|-------------|
| Past | memory-atlas | per-repo `npm i -D memory-atlas` | `atlas gate` / SessionStart |
| Present | agentic-sage | once `npm i -g agentic-sage` | `sage gate` / preferred offline |

Desk wire (manjaro / power users): `node scripts/fleet-desk-wire.mjs`
