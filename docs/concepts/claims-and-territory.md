---
title: "Claims and territory"
description: "Touched vs claimed globs, territory pre-flight, and what merge-brief actually contests."
section: concepts
order: 20
---

# Claims and territory

SAGE tracks two different signals on each live session. Mixing them up is how sessions get a false “clear to merge.”

| Signal | Field | Meaning | Who writes it |
|--------|--------|---------|----------------|
| **Touched** | `touched_globs` | Paths this session’s checkout has actually dirtied (git fact) | Emitter / `sage register` git enrich |
| **Claimed** | `claimed_globs` | Paths this session *intends* to own (intent) | `sage claim <glob…>` |

Both count for collision tools. A session that has only *claimed* a path still conflicts with a peer that claimed or touched the same path.

## Pre-flight: `sage territory`

Ask whether **any other live session** claims or touches the globs you are about to work on.

```text
$ SAGE_SELF_SID=session-a sage territory 'src/auth/**'
SAGE territory · src/auth/**
  feat/auth          claimed  idle     src/auth/**
```

The first column is the peer’s **branch name** (not its session id). Empty answer:

```text
SAGE territory · lib/unrelated/**
  clear — no other session claims or touches this
```

The `via` column is either `claimed` or `touched`. Self is excluded so you do not collide with yourself.

## Before merge: `sage merge-brief`

Lists paths that **two or more other live sessions** have touched or claimed (judges and synthetic agent-status rows are ignored).

Example (three live sessions on distinct branches all claimed `src/auth/**`;
caller is the one on `main`):

```text
$ SAGE_SELF_SID=session-a sage merge-brief
SAGE merge-brief · agentic-sage-0e480620 · RISK █░░░ low · 1 contested path(s)
  src/auth/**  █░░░ low  ██
    contested by: fix/board, feat/auth
```

`contested by:` lists **branch names** of the other live sessions. Two peers on
the same branch will show that name twice. Here `src/auth/**` is contested
**via claims** (no one needed to edit the files first). Dirty checkouts may
also surface touched paths (for example `node_modules`) when register recorded them.

Clear output when nothing multi-party conflicts among peers:

```text
SAGE merge-brief · agentic-sage-0e480620 · 0 contested path(s)
  no contested paths — clear to merge
```

### Important: self is not counted

`merge-brief` excludes the calling session when self can be resolved (`SAGE_SELF_SID` or pid-walk). A path needs **two or more other** live sessions on it before it appears.

Consequence for the common two-worker desk:

| Situation | `territory` | `merge-brief` (self resolved) |
|-----------|-------------|-------------------------------|
| You + one peer both claim `src/auth/**` | Peer listed (`via claimed`) | **clear to merge** (only one *other* session) |
| You + two peers claim the same path | Both peers listed | Contested |

So for pairwise “is anyone else on this?”, trust **`sage territory`**. Treat **`merge-brief` clear** as “no multi-party peer clash,” not as “my claim is unique.”

That self-exclusion is how the code works today; if you expected merge-brief to include your own claim against a single peer, document it as a **known limitation**, not as “claims are ignored.” Claims *are* counted among the peers that remain after self is dropped.

## Live sessions only

Only `working` / `idle` / `stalled` peers count. Dead or closed history is ignored so old ghosts do not cry wolf. Judge sessions and synthetic agent-status rows never participate in territory or merge-brief.

## Related

- [Fleet judge](./fleet-judge.md)
- [CLI reference](../reference/cli.md)
- Recipe: [Live judge](../recipes/live-judge.md)
