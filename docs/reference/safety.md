---
title: "Safety"
description: "Default-OFF, fail-open, write containment, session identity, reader bounds, guard, and hermetic-HOME test notes."
section: reference
order: 40
---

# Safety

SAGE is built to be invisible when you do not want it, non-blocking when something goes wrong, and strict about where session records may be written.

## Default OFF

Judging does not start until you opt in:

- Global install: `sage on` (master switch in `~/.claude/agentic-sage/config.json`)
- Project install: `sage enable` in that repo

Install alone leaves the machine unjudged.

## Fail-open emitter

The lifecycle hook (`hooks/agentic-sage-emit.mjs`) runs on many session events. Any error exits 0 and allows the action. A broken SAGE never blocks an agent tool call.

While OFF, the emitter is a first-line no-op.

## Write containment

Session records live under the resolved per-repo data directory (typically
`~/.claude/agentic-sage/repos/<repo_id>/sessions/<sid>.json`). Two rules keep
writes from escaping that tree.

### Session ids are path tokens, not paths

`sid` becomes a filename. Separators, `..`, spaces, and other non-token
characters are refused. Allowed shape (enforced in `lib/store.mjs`
`isSafeSessionId`): length 1–200, characters matching
`^[A-Za-z0-9._@+=:-]+$`.

CLI early reject for path-shaped ids (`/`, `\`, or `../`):

```text
$ sage register --sid '../escape'
sage: register soft-fail — unsafe session id
# exit 2

$ sage register --sid '../escape' --json
{"ok":false,"sid":"../escape","reason":"unsafe session id"}
# exit 2

$ sage register --sid 'foo/bar'
sage: register soft-fail — unsafe session id
# exit 2
```

Other unsafe tokens (for example a space) go through the same soft-fail path
with exit **1** after the library check:

```text
$ sage register --sid 'has space'
sage: register soft-fail — unsafe session id
# exit 1
```

`claim` and self resolution refuse the same shapes on `SAGE_SELF_SID`:

```text
$ SAGE_SELF_SID='../x' sage claim 'lib/**'
sage: refusing an unsafe SAGE_SELF_SID
# exit 2
```

Missing `--sid` is usage, not a store write:

```text
$ sage register
usage: sage register --sid <id> …
# exit 2
```

### Storage root realpath check

Every session write resolves the repo data root once and requires the write
target’s parents (and any symlink targets along the way) to stay inside that
root. A `sessions/` directory replaced with a symlink that points outside the
repo data dir is refused; the outside directory is not written.

Observed refusal (paths shortened; your home and repo id will differ):

```text
# sessions/ was a symlink pointing outside the repo data dir
$ sage register --sid 'evil'
sage: register soft-fail — path escapes storage root: …/repos/<repo_id>/sessions/evil.json
# exit 1
# the outside directory stays empty
```

Exit map for `sage register` (verified):

| Exit | Meaning |
|------|---------|
| 0 | Registered / heartbeat / close succeeded |
| 1 | Soft-fail (not a git repo, store write refused, unknown sid on heartbeat, other `isSafeSessionId` rejects) |
| 2 | Usage error or path-shaped unsafe `--sid` |

Launchers that want fire-and-forget can append `|| true`. Prefer checking
exit codes when you care about containment.

## Session identity

A live row is not “one agent process.” Identity is split:

| Field | How it is chosen | Shared across worktrees? |
|-------|------------------|---------------------------|
| `repo_id` | Hash of the main / common git dir (`resolveRepoRoot` via `--git-common-dir`) | **Yes** — outer and nested worktrees of one product share one fleet |
| `session_id` | Caller-supplied `--sid` (must pass `isSafeSessionId`) | Unique per declaration |
| `worktree` | Checkout root of **this** session’s cwd (`git rev-parse --show-toplevel`) | **No** — each linked/nested worktree keeps its own path |

`sage register` stores `worktree` as that session checkout, not only the main
repo root. Nested worktrees therefore appear as **two sessions** under one
`repo_id`, each with its own `worktree` string.

Verified shape (paths illustrative):

```text
$ sage register --sid outer-sess --cwd <outer-worktree> --json
{"ok":true,"sid":"outer-sess","repo_id":"<repo_id>"}

$ sage register --sid inner-sess --cwd <nested-worktree> --json
{"ok":true,"sid":"inner-sess","repo_id":"<repo_id>"}

$ sage board --json
# two rows, same repo_id, different worktree values
```

What this does **not** do: two processes that share the **same** working
directory still look like one checkout for path purposes. Distinguish them
with different `--sid` values (and claims), not by hoping the store invents a
second worktree path.

## Reader robustness

Board and store readers must not hang on hostile or accidental entries under
`sessions/`.

- **Regular files only.** `readJson` and the board scanner call `stat` and
  skip anything that is not a regular file (FIFO, socket, directory).
- **Corrupt JSON is skipped.** Parse failure → treat as missing; other
  sessions still list.
- **Unsafe sid on read.** `readRecord` with an unsafe `sid` returns `null`
  without following a crafted path.

Verified: with a real session file, a `*.json` FIFO, a directory named
`*.json`, and a corrupt `*.json` in the same sessions directory, `sage board
--json` returns only the real session and finishes in well under a second
(observed on the order of ~100 ms). It does not block on the FIFO.

Malformed entries produce **no error line** on the board path — they are
omitted. That is intentional fail-open for the roster: one bad file must not
take down fleet visibility.

Writers still use atomic tmp+rename and a short-lived per-file lock
(bounded retries, stale takeover) so concurrent hook and CLI merges do not
leave half-written JSON. Lock wait is bounded; a stuck lock is taken over
after a short stale window rather than hanging forever.

## The guard (optional, default OFF)

`sage guard` can block edits to contested paths (`PreToolUse` → exit 2). Two
switches must both be on:

1. Judging enabled for the install (`sage on` / `sage enable`)
2. `sage guard on` for the repo

Invariants: fail-open on error, default-off, cheap no-op when no guard is armed.

Do not arm the guard unless you explicitly want hard blocks.

## What it does not do

- Does not edit your product tree as “help”
- Does not spawn agent sessions
- Does not merge branches or open PRs
- Does not lock files — claims are advisory unless you arm the guard
- Does not network-publish session state or developer logs (see
  [Developer logging](./developer-logging.md))

## What `sage init` wires

It merges lifecycle hooks into the target settings file (backup once,
skip-if-present, abort on malformed JSON) and links skills. It does **not**
auto-enable unless you pass `--enable`.

| Hook event | Effect |
|------------|--------|
| `SessionStart` | Record/refresh session; optional soft fleet line |
| `UserPromptSubmit` | Refresh liveness |
| `PostToolUse` | Throttled liveness refresh |
| `Stop` | Last-turn-fresh record |
| `PreCompact` | Lightweight handoff sidecar |
| `SessionEnd` | Mark closed |
| `PreToolUse` | Guard only (inert unless armed) |

Undo: `node uninstall/uninstall.mjs` (surgical; keeps state for manual delete).

## Contributor note: hermetic HOME and `process.execPath`

CLI and emitter tests set a temporary `$HOME` so they never touch the human’s
real SAGE state. On desks where `node` on `PATH` is a version-manager shim that
resolves the interpreter under `$HOME` / `$NVM_DIR`, a hermetic home with no
nvm tree makes every bare `node …` child exit **127** with a message like
`error: no nvm Node >= 24` **before product code runs**. That is a harness
artifact, not a SAGE product defect.

How to write a test here that does not depend on the developer’s machine:

1. Import `NODE` and `hermeticEnv` from `test/helpers.mjs` (or use
   `process.execPath` directly).
2. Spawn suite children as `NODE` / `process.execPath` + script argv — never
   bare `"node"`.
3. Do not hardcode nvm paths or export the developer’s real `NVM_DIR` into
   shared helpers to “make CI green on one laptop.”
4. Keep hermetic `HOME` mandatory so tests stay out of real state.

Product self-spawns already prefer `process.execPath` in several paths; the
suite helpers match that rule so hermetic runs stay portable across nvm desks,
system Node, and clean environments.

## Related

- [Configuration](./configuration.md)
- [CLI reference](./cli.md)
- [Claims and territory](../concepts/claims-and-territory.md)
- Human checklist: [`SETUP.md`](../../SETUP.md)
