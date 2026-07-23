---
type: plan
summary: "Implement docs soft-nudge on recollection + works-with + docs-kit health for sage pilot."
tags: [docs, recollection, docs-kit]
status: ready
created: 2026-07-23
updated: 2026-07-23
implements:
  - "[[2026-07-23-docs-recollection-health-design]]"
produced: []
commitRange: ""
related: []
sources: []
---

# Docs recollection health — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Soft-nudge docs health on recollection, docs-kit health command, sage works-with + contextual fleet mentions.

**Architecture:** Extend docs-kit for health reports; extend atlas-recollection skill checklist; sage public docs + CLAUDE/npm scripts. Soft nudge only — never hard-block finish for docs alone.

**Tech Stack:** Node docs-kit, markdown docs, memory-atlas skill markdown.

## Global Constraints

- Soft nudge only (user chose A) — always report docs; do not fail session finish solely on docs.
- Specs/plans stay in `*-mind/`; public prose in `docs/`.
- No invented fleet integrations — only real relationships.
- Contextual mentions in feature pages + works-with map (nice addition).
- Pilot scope: agentic-sage + docs-kit + memory-atlas skill; not all six packages yet.
- Prefer surgical edits; YAGNI.

---

### Task 1: docs-kit health command

**Files:**
- Modify: `/home/kento/Repositories/docs-kit/bin/docs-kit.mjs`
- Modify: `/home/kento/Repositories/docs-kit/tests/check.test.mjs` (or add `tests/health.test.mjs`)
- Modify: `/home/kento/Repositories/docs-kit/README.md`
- Modify: `/home/kento/Repositories/docs-kit/VERSION` → `0.1.1` if shipping behavior change

**Interfaces:**
- Produces: `docs-kit health <docs-dir>` — runs check + relative-link warnings; exit 0 if check passes even with warnings; exit 1 if frontmatter/meta fail
- Produces: stderr human report; `--json` includes `{ ok, issues, warnings }`

- [ ] **Step 1:** Add failing test: `health` on valid docs with a broken relative link yields warning in output but exit 0
- [ ] **Step 2:** Implement `health` (reuse check logic; scan markdown for `](*.md)` relative targets that don't resolve)
- [ ] **Step 3:** Wire CLI help; README; tests green
- [ ] **Step 4:** Commit in docs-kit repo

---

### Task 2: atlas-recollection docs soft-nudge

**Files:**
- Modify: `/home/kento/Repositories/memory-atlas/skills/atlas-recollection/SKILL.md`

**Interfaces:**
- Produces: checklist items  after atlas check for Docs soft-nudge; report format template

- [ ] **Step 1:** Add section **Docs soft-nudge (public product docs)** after existing checklist
- [ ] **Step 2:** Include: detect `docs/`; run docs-kit check/health; relevance pass bullets; fleet mention rule; report format:

```text
## Recollection
- zones: …
- docs: ok | warnings | N/A (reason)
- docs actions: updated X | none
```

- [ ] **Step 3:** Commit memory-atlas skill change

---

### Task 3: agentic-sage works-with + contextual mentions

**Files:**
- Create: `/home/kento/Repositories/agentic-sage/docs/works-with.md`
- Modify: `/home/kento/Repositories/agentic-sage/docs/_meta.json`
- Modify: `/home/kento/Repositories/agentic-sage/docs/recipes/statusline.md` (and/or getting-started / interop pointers) for real sibling mentions
- Modify: `/home/kento/Repositories/agentic-sage/docs/index.md` link works-with
- Modify: `/home/kento/Repositories/agentic-sage/package.json` scripts (`docs:health`)
- Modify: `/home/kento/Repositories/agentic-sage/CLAUDE.md` recollection pointer to docs soft-nudge

**Interfaces:**
- works-with table: status-herald, token-oracle, memory-atlas, llm-armory, mossferry — honest one-liners + links

- [ ] **Step 1:** Write works-with.md with frontmatter
- [ ] **Step 2:** Add contextual mentions only where true (token forecast path, herald interop, atlas mind, armory sessions, ferry as remote host pattern if accurate)
- [ ] **Step 3:** `npm run docs:check` / docs:health green
- [ ] **Step 4:** Commit agentic-sage

---

### Task 4: Verify + recollection self-apply

- [ ] **Step 1:** Run docs-kit tests + sage docs:check
- [ ] **Step 2:** Rebuild site docs optional (`agentic-sage-site npm run docs:build`)
- [ ] **Step 3:** Short decision note if needed under mind/map/decisions
- [ ] **Step 4:** Final commit if any fixups
