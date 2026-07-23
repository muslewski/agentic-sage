---
name: sage-fleet
description: >
  Use when starting work, before opening a PR, or resolving a merge conflict while other
  agent sessions may be running in parallel on the same repo. Coordinate through the `sage`
  CLI — collision check, claim intent, merge brief, why-diverged — so parallel sessions merge
  smoothly. Advisory only; a silent no-op when SAGE is off or not installed.
---

# sage-fleet — you are one session in an army

SAGE is a **passive fleet judge**. The human watches the army from `sage war`.
**You** (this session) speak four short truths so parallel work merges cleanly.

Graceful degradation first: if `sage` is missing, errors, or prints nothing — **proceed**.
SAGE is optional infra, never a hard dependency. Never block yourself because it is off.

## The one rule

SAGE advises; it does not arbitrate. Two live sessions on the same code → **surface to the human**.
Do not guess who wins.

## Live judge briefs (optional)

If a **live judge** session is online, consult output may append layered sections
(`── live judge · repo …` / `── live judge · fleet …`). Treat those as **advisory
narrative**. Deterministic lines (clear / contested / RISK bars) remain
**authoritative** for path overlap. If a brief contradicts CLI facts → **trust CLI**
and surface the contradiction to the human. Never wait for a judge; no brief =
proceed as always. Use `--no-brief` when you want facts only.

## Four touchpoints (do them)

### 1. Work-start — claim before you write

```bash
sage backlog                          # is your row already held by a LIVE session?
sage backlog claim D11                # register THIS session's row (when you have one)
sage territory 'src/feature/**' 'docs/**'
# overlap with another LIVE session → narrow scope OR surface to the human
sage claim 'src/feature/**' 'docs/**' # register file intent so the next session sees you
```

Live-only: dead/`/clear` ghosts do **not** count as contention. If territory is clear, trust it.

### 2. Mid-flight — one glance

```bash
sage fleet      # one line: how many live, nearest neighbour + path
```

Empty / "no other sessions" → you are alone. Non-empty → read it.

### 3. Before PR / finish branch

```bash
sage merge-brief                 # LIVE contested paths only
sage why-diverged path/to/file   # for each real contested file
sage backlog                     # no orphan/drift on your row before you mark ✅
```

Generated files (lockfiles, codegen): **regenerate, don't hand-merge**.

### 4. On a merge conflict

```bash
sage why-diverged path/to/file   # the other session's intent, then resolve
```

## Machine / Hermes

```bash
sage board --json    # this repo
sage fleet --json    # nearest-neighbour envelope (+ self_sid)
sage war --json      # cross-repo fleet (totals are live-first)
```

Schema: `SCHEMA.md`. Ignore unknown fields. Contested/human/nested in war totals are **live**.

## What you never do

- Treat SAGE silence as failure
- Claim without checking territory when others may be live
- Merge past a live contested path without telling the human
- Arm the guard (`sage guard on`) unless the human explicitly asked
