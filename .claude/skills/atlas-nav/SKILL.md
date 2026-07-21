---
name: atlas-nav
description: Use when navigating a repo's code or its Atlas — locating a definition/usage/file, tracing an import, or finding which zone/decision/spec explains something. Reach here before reflexive grep+Read.
---

# Navigating code and the Atlas

Default to this repo's configured retrieval engine over grep+read-whole-file
— same correctness, far fewer tokens read. If this repo uses the ctx-search
adapter (`adapters/ctx-search/`), that engine is `ctx_search` (the
context-mode MCP tool), kept fresh automatically by a SessionStart hook.
Otherwise use whatever retrieval engine the repo documents, or fall back to
grep — this skill's routing logic applies either way.

**With `ctx_search`: call it with NO `project` param** — it defaults to the
repo (cwd), which is where both buckets are indexed. Results are tagged
`Source: code:…` / `Source: atlas:…`; narrow with `source: code` /
`source: atlas`. Folders listed in `atlas.config.json` →
`retrieval.excludeFromSearch` (default `drafts/`, `visuals/`) are never in
the index — don't expect hits from them.

## Route by intent

| Intent | Tool |
|---|---|
| Known file path | Read directly — no search |
| Exact symbol ("where is X defined / who calls X") | LSP / go-to-definition, if available |
| Broad ("where is X / which note explains Y / find the invariant / which spec") | Configured retrieval engine (`ctx_search` if this repo has the adapter) |
| Engine result empty/wrong, or an exhaustive match list is needed | grep + Read fallback |

## Per-bucket mode

**Atlas hits** (`Source: atlas:…`) — the snippet usually captures the
zone/decision summary inline; no follow-up read needed for orientation.

**Code hits** (`Source: code:…`) — use the engine to RANK, then Read the top
~3 whole hit files; snippets alone miss the answer span.

## Rules

- Query with distinctive content terms, not whole questions ("pending
  webhook retry queue", not "which note documents the pending webhook retry
  queue").
- Retrieval is lazy and per-question — reach for it freely, but NEVER
  preload the whole Atlas or code tree; that re-pays the tokens the engine
  just saved.
- If results look stale and this repo has the ctx-search adapter:
  `node scripts/nav-refresh-index.mjs --force`, then retry.
