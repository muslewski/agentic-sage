---
name: atlas-seed
description: Use when an Atlas vault is empty or near-empty (0–2 zones after atlas init) — bootstrap 4–8 seeded zone cards from a real codebase analysis. Also use for "seed the mind", "initial zones", "first map pass", "bootstrap atlas", or atlas-fleet seed-empty.
---

# Atlas seed — initial zone bootstrap from code

**Goal:** turn a scaffolded vault into a usable map after `atlas init`, without
lying about verification.

This is the **first pass**, not recollection. Cards stay honest:

| Field | Required value |
|-------|----------------|
| `status` | `seeded` |
| `verifiedAt` | `unverified` |
| `type` | `zone` |

Never promote to `active` or stamp a SHA in this skill. Only a later human (or
explicit `atlas stamp` after review) does that.

## When to run

- Vault exists (`map/zones/` empty or only stubs)
- `atlas status` shows `0 zones` (or 1–2 toy cards)
- After `atlas-fleet ensure-all` / `atlas init` on a new repo
- Re-seed only if the old seed was wrong *and* still `seeded` / never verified

Do **not** run as a substitute for `atlas-recollection` after product work —
that skill updates touched zones; this one creates the first partition.

## Inputs to read (order)

1. Repo `README.md` / `AGENTS.md` / `package.json` (or Cargo.toml / pyproject) — thesis
2. Top-level tree (`ls`, not whole monorepo dump)
3. Entry surfaces: `bin/`, `src/`, `lib/`, `packages/`, `app/`, `cli/`
4. Tests / CI if present — good `enforcedBy` candidates later
5. Existing vault `map/overview.md` if any

Skip: `node_modules`, `dist`, `.git`, huge generated assets.

## How to partition (4–8 zones)

Prefer **coherent ownership** over fine-grained files:

| Typical zone | Owns (examples) |
|--------------|-----------------|
| `core` / `engine` | main lib, domain logic |
| `cli` / `bin` | binaries, argument surface |
| `api` / `server` | HTTP / RPC entry |
| `ui` / `web` | frontend app |
| `config` / `install` | config schema, installers |
| `adapters` / `integrations` | pluggable backends |
| `tests` / `ci` | only if tests are a product surface (e.g. contract suite) |
| `docs` / `site` | marketing site *in-repo* only if substantial |

Rules:

- **One concept per zone** — not "misc" or "utils" dumps.
- **4–8 cards** for a normal repo; tiny repos may have 3; monorepos up to ~10.
- Prefer directory-level `owns.globs` (`src/lib/**`) over listing every file.
- Every glob MUST match ≥1 **git-tracked** file (`git ls-files '<glob>'` or
  equivalent). Empty globs fail `atlas check`.
- No-git workspaces: still use real paths that exist on disk; note in overview
  that check may be limited until `git init`.

## Zone card shape

Use the vault template (`templates/zone.md`) as base. Frontmatter YAML must
parse under atlas's subset (flow-style arrays for nested lists):

```yaml
---
type: zone
summary: "Distinctive 1–3 sentence thesis with real nouns (what + where)."
tags: [domain-tag]
status: seeded
created: YYYY-MM-DD
updated: YYYY-MM-DD
verifiedAt: unverified
owns:
  routes: []
  testids: []
  globs:
    - "src/foo/**"
    - "bin/bar.mjs"
  tools: []
depends: []
invariants: []
skills: []
related: []
sources: []
---

## What this is

Short prose. Distinctive terms for retrieval (see writing-for-retrieval).

## Anchors

Why these globs / what boundary they draw.

## Invariants

Only load-bearing rules you can point at. Prefer empty `invariants: []` over
invented rules. If you claim a rule, use flow-style enforcedBy:

  - rule: "…"
    enforcedBy: ["path/to/file.ts"]

## Lineage

README / design notes / "inferred from tree on YYYY-MM-DD seed pass".
```

Also follow **writing-for-retrieval**: summary carries distinctive terms;
`##` sections = one concept each.

## Also write / update

1. **`map/overview.md`** — one-paragraph product thesis + list of seeded zones
2. **`atlas build`** — regenerate `map/index.md` (never hand-edit index)
3. Optional: one `tech-debt/` note if the tree has an obvious systemic gap
4. Optional: one `map/decisions/` only if the README already records a real ADR
   (do not invent ADRs)

## Forbidden

- `status: active` or commit SHA in `verifiedAt` without review
- Copying personal / life content into any vault (esp. personal-knowledge-base —
  meta zones about *repo structure* only)
- Claiming package dependencies between fleets that are only "same stack"
- Wiping existing **active** zones — this skill is additive for empty/scaffold
- Silent blanket rewrites of human-edited cards

## Done criteria

```bash
atlas status    # shows N zones (N ≥ 3), all still seeded/unverified in cards
atlas build     # index lists new zones
atlas check     # no hard parse errors; ownership OK if globs match tracked files
```

Report: zone slug list + one line each purpose. Cards remain `seeded` until
someone runs recollection + stamp.

## Related skills

- **writing-for-retrieval** — summary / section craft while authoring
- **atlas-nav** — after seed, orientation uses the map
- **atlas-recollection** — later sessions update zones after real work
- **atlas-adopt** — brownfield vaults that already have notes, not empty init
