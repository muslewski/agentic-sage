---
type: spec
summary: "Soft-nudge docs health on recollection + contextual fleet cross-links; docs-kit health; sage pilot."
tags: [docs, recollection, docs-kit, memory-atlas, fleet]
status: approved
created: 2026-07-23
updated: 2026-07-23
origin: "brainstorming session 2026-07-23; user chose soft nudge (A) + contextual fleet mentions"
related: []
sources:
  - "[[docs-kit]]"
  - "memory-atlas atlas-recollection"
---

# Design: Docs recollection health + fleet contextual mentions

## Problem

Public product docs (`docs/`) drift from code. Recollection (memory-atlas) updates zones and stamps but does **not** systematically surface “should public docs change?” Agents finish sessions without a docs report. The six fleet packages interoperate (e.g. token-oracle gauges in status-herald bar) but public docs rarely name siblings **in context**.

## Goals

1. After real work, recollection **always includes a Docs section** (soft nudge — never blocks finish solely for docs).
2. If user-facing surface changed, the agent is expected to **update `docs/` in the same change when relevant**, or state **docs N/A** with a one-line reason.
3. When a feature **actually uses** a sibling product, public docs **mention that sibling in the feature prose** (not only a generic footer).
4. A short **works-with** page lists the fleet graph once (nice addition).
5. Mind vault stays architecture/specs; public docs stay product-facing.
6. Pilot **agentic-sage**; pattern is fleet-reusable via **docs-kit** + **atlas-recollection**.

## Non-goals

- Auto-generating full guide prose from CLI help.
- Hard-failing merge on missing docs (soft nudge only).
- Inventing integrations that do not exist in code.
- Rolling out all six packages in this change (sage pilot only; templates enable later).

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Finish behavior | **Soft nudge (A)** |
| Fleet overlap | **Contextual in-sentence mentions** + optional **works-with** map |
| Shared tooling | **docs-kit** health + recollection skill checklist |
| Spec location | `agentic-sage-mind/specs/` (not `docs/superpowers/`) |

## Architecture

```text
finish work
    → atlas recollection (zones, stamp, check)     [existing]
    → docs-kit health docs/                        [new / extended]
    → docs relevance pass (agent judgment)         [checklist in skill]
    → optional docs/*.md edits + works-with touch  [same commit when relevant]
    → report: "recollection done; docs: …"         [always]
```

### Components

1. **docs-kit `health` (or extended `check`)**  
   - Existing frontmatter + `_meta.json` validation.  
   - Optional warnings: broken relative links among docs pages.  
   - Exit 0 for pure warnings; non-zero only for check failures (frontmatter).  
   - Human-readable report on stderr; `--json` for tooling.

2. **atlas-recollection skill**  
   - New checklist items: run docs-kit when `docs/` exists; relevance pass; fleet mention check; report format.  
   - Soft: do not require green docs-kit to end session; do require the **report**.

3. **agentic-sage product wiring**  
   - `CLAUDE.md` / recollection pointer aligned with skill.  
   - `npm run docs:check` / `docs:health`.  
   - `docs/works-with.md` + contextual sibling mentions where interop is real.  
   - `_meta.json` sidebar includes works-with.

4. **Fleet graph (static)**  
   Sage works-with table at minimum: status-herald, token-oracle, memory-atlas, llm-armory, mossferry — relationship one-liners + links. Only claim real relationships.

## Docs relevance pass (agent checklist)

Trigger signals (any → consider doc edit):

- Diff in `bin/`, public CLI USAGE, hooks, install, user-facing config keys  
- New/changed command or flag  
- New interop with sibling package  
- User-visible UX copy (statusline, board labels)

**docs N/A** when: tests-only, pure internal refactor, mind-only, private/debug.

Never auto-rewrite entire guides. Prefer minimal surgical edits.

## Contextual fleet mention rules

- Mention sibling **where the feature is documented**, once, with link (homepage or npm).  
- Example shape: “Optional token gauges use a **token-oracle** forecast feed when configured.”  
- Update works-with when adding/removing a real integration edge.  
- Do not spam every page with the full fleet list.

## Success criteria (pilot)

- [ ] `docs-kit check|health` green for agentic-sage `docs/`  
- [ ] Recollection skill documents Docs soft-nudge steps + report format  
- [ ] sage `docs/works-with.md` exists and is in `_meta.json`  
- [ ] At least one contextual sibling mention in sage product docs where interop exists  
- [ ] Tests for docs-kit health/check still pass  
- [ ] Spec committed under mind; no `docs/superpowers/` resurrected  

## Out of scope this pilot

- CI hard-fail on docs (optional later)  
- Auto CLI surface vs docs diff beyond simple optional hints  
- Implementing works-with pages for the other five packages  

## Rollout

1. Ship docs-kit + recollection skill + sage docs.  
2. After dogfood, copy pattern to mossferry, herald, oracle, armory, atlas.
