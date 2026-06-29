---
name: sage-fleet
description: >
  Use when starting work, before opening a PR, or resolving a merge conflict while other
  agent sessions may be running in parallel on the same repo. Coordinate through the `sage`
  CLI — collision check, claim intent, merge brief, why-diverged — so parallel sessions merge
  smoothly. Advisory only; a silent no-op when SAGE is off or not installed.
---

# sage-fleet — coordinate with the other sessions

SAGE is a passive fleet judge. The **human** reads `sage board` / `sage fleet` at fleet
altitude; **you (this session)** run the verbs below at four moments so many parallel sessions
add features without colliding and merge smoothly. You stay advisory — SAGE never decides for
you and never blocks; on a real collision you **surface to the human**.

## Graceful degradation (read first)

Every step is best-effort. If `sage` is not on `PATH`, or any `sage` call errors or prints
nothing, **proceed normally** — SAGE is optional infra, never a dependency. Never block your own
work because SAGE is absent or off.

## The four touchpoints

**1. At work-start (after the design "go", before you write the plan or touch a file).**
First claim your backlog ROW, then check file territory:

    sage backlog                                 # is your intended row already held by a LIVE session?
    # if a live session holds your row → take a different row, or surface the overlap to the human.
    sage backlog claim D11                        # register THIS session's row so the next session sees you

    sage territory 'src/feature/**' 'docs/**'    # …then the file-path collision check
    # if it reports another session's live claim on overlapping paths:
    #   → narrow your scope to non-overlapping globs, OR surface the overlap to the human.
    sage claim 'src/feature/**' 'docs/**'        # register THIS session's file intent

`sage backlog claim` writes your `claimed_row`; `sage claim` writes your `claimed_globs` — together the
*next* session's `sage backlog` / `sage territory` see you.

**2. Periodically / before a large multi-file edit.** A quick sanity check:

    sage fleet      # one-line fleet summary — anyone now in your area?

**3. Before opening a PR / finishing the branch.** Make the merge boring:

    sage merge-brief                 # contested paths across the fleet
    sage why-diverged path/to/file   # for each contested file: the other session's intent
    sage backlog                     # confirm no orphan/drift on your row before you hand-edit its ✅

For a **generated** file (lockfile, generated types, a built manifest), apply
**regenerate-don't-merge**: re-run its generator on the merged source instead of hand-merging
the artifact.

**4. On a git/merge conflict.** Before you resolve a conflicted file:

    sage why-diverged path/to/file   # read why the other branch changed it

Resolve with that intent in mind; for generated files, regenerate rather than line-merge.

## The one rule

SAGE advises; it does not arbitrate. When two sessions genuinely contend for the same code,
that decision is the human's — surface it rather than guessing. Keeping the human at *fleet*
altitude is the whole point.
