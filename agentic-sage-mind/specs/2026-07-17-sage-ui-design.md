---
type: spec
summary: "agentic-sage board rebuild + semantic paint — design spec"
tags: [migrated-from-docs-superpowers]
status: planned
created: 2026-07-23
updated: 2026-07-23
origin: "migrated from docs/superpowers/specs/2026-07-17-sage-ui-design.md"
related: []
sources: []
---

# agentic-sage board rebuild + semantic paint — design spec

**Date:** 2026-07-17 · **Status:** approved · **Phase:** 5 of the fleet UI campaign
**Inputs (binding):** the agentic-sage section of `~/.cache/armory-research/UPGRADE-BRIEF.md`, the four audits `~/.cache/armory-research/repos/agentic-sage-*.md`, `~/.cache/armory-research/PLAYBOOK.md`.

## North star
`sage war` is the design target — its panel/column/HEAT-spark quality applied to the daily surfaces. Zero runtime deps stays absolute. All machine-parsed output (`--json`, any schema) byte-stable. Color flows through the existing `render* → paint()` chokepoint — upgrade it to SEMANTIC paint (state → style mapping), never post-hoc token painting that false-colors help prose (the audit's exact complaint).

## Child A — the board rebuild (the L centerpiece)
`sage board` today is a history landfill: olive ● on dead rows, no headers, zone names mid-clipped (`ocs/`), 80+ archive rows drowning the living. Rebuild:
1. **Live-first roster** — running/attention sessions on top with column headers; per-row ctx gauge (context % as compact block gauge), full zone names (fix the mid-clip), activity age.
2. **Archive fold** — dead/stale rows collapse into one dim line `▸ archive (N)`; `--all` (or existing flag convention) expands; dead rows render dim, never olive-live.
3. **fzf jump** — TTY+fzf: pick a live row → emit the repo's natural jump action (discover what makes sense from existing conventions: print path / attach hint); non-TTY: plain roster, parse-stable.
4. **Semantic paint** — extend `paint()` with a state→style map (live/attention/idle/dead); help prose stays uncolored.

## Child B — ops surfaces (after A merges)
5. **`sage doctor`** — health banner + checklist with fix-hint lines (node twin of the kit language), exit codes unchanged.
6. **`sage merge-brief` / `why-diverged`** — risk score chip + heat sparkline per path; TTY+fzf path drill-in.
7. **`sage repos`** — product/orphan grouping, activity sparkline, live-session gauges, subagent noise filtered; TTY+fzf row → board jump.
8. **`sage fleet` + statusline** — composable HUD segments (live count, ⚔, ctx, asking pulse); no empty chips ever rendered.

## Acceptance
- s1 (A): board fixture with 3 live + 80 dead → live rows with headers + gauges on top, ONE archive fold line, no olive on dead; `--all` shows everything; non-TTY output has zero ANSI and stable row grammar; `--json` byte-identical to before.
- s2 (A): zone names never mid-clip at the fixture widths; ctx gauge reflects fixture percentages.
- s3 (A): paint() maps states semantically; help output contains zero color codes.
- s4 (B): doctor exit codes unchanged; every failure line followed by a fix hint.
- s5 (B): repos groups correctly on fixtures; fleet/statusline render no empty chips; merge-brief shows risk + spark on fixture data.
- Both: existing test suite green, assertions unmodified; zero new deps (package.json dependencies unchanged); NO_COLOR strips everything.
