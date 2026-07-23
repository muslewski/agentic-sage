---
type: zone
summary: "Agent-facing distribution surface — `sage-fleet`, `sage-judge`, and `sage-doctor` skills plus CLAUDE/GROK/statusline paste snippets that teach sessions when to consult the fleet judge without baking protocol into every CLAUDE.md."
tags: [skills, templates, distribution, live-judge]
status: seeded
created: 2026-07-21
updated: 2026-07-21
verifiedAt: unverified
owns:
  routes: []
  testids: []
  globs:
    - "skills/**"
    - "templates/**"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

On-demand skills linked at install time so agents claim territory, run merge-brief, and self-check config. Snippets are one-line pointers into those skills (Claude `CLAUDE.md`, Grok-native `AGENTS.md`, statusline segment for "Asking Sage"). Keeps a disabled SAGE nearly free in prompt weight.

## Anchors

- `skills/sage-fleet/SKILL.md` — coordination protocol (+ how to treat live-judge briefs)
- `skills/sage-judge/SKILL.md` — optional continuous brief loop for a dedicated judge pane
- `skills/sage-doctor/SKILL.md` — `/sage-doctor` validity check
- `templates/*.snippet.md` — paste targets for harness docs and statusline

## Invariants

Prefer empty until verified.

## Lineage

README "Parts & options", AGENTS.md wire step, package.json `files` list, 2026-07-21 atlas-seed pass.
