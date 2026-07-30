---
title: "Troubleshooting"
description: "Symptom → literal message → fix for install health, board roster, claims, storage, and hermetic Node."
section: reference
order: 50
---

# Troubleshooting

SAGE is a passive fleet judge: sessions register, claim globs, and ask whether
merging is safe. This page is organised by **what you see**, not by internal
module names. Every message and exit code below was reproduced with
`node bin/sage` on a real machine (or a temporary `HOME` for install-empty
cases). Paths are written as `~/…` or placeholders — not machine-specific.

When in doubt, run:

```bash
sage doctor
sage where
sage board --wide
```

---

## Live judge preferred but offline

**What you see** (any of these, exit **0**):

```text
sage: live judge preferred · offline — run: sage judge run
```

```text
$ sage gate
sage: live judge preferred · offline — run: sage judge run
```

```text
$ sage doctor
  …
  ✓ live judge — preferred · offline — run: sage judge run
  …
```

```text
$ sage judge status
SAGE judge status
  fleet: stale/offline · sid <sid> · <iso-timestamp>
  repo:  stale/offline · sid <sid> · <iso-timestamp>
```

```text
$ sage judge show
sage: no fresh repo brief

$ sage judge show --fleet
sage: no fresh fleet brief
```

**What it means:** global config has `judge.desired: "preferred"` and there is
no live judge session and no **fresh** attachable brief. That is a soft
preference, not an install failure. Doctor still marks the live-judge row with
**✓** and still exits **0**. `sage gate --strict` also stays exit **0** for this
line alone (strict fails only on install / freshness lag).

**Fix (pick one):**

1. Start a living mind: `sage judge run` (or `sage judge run --fleet`, or
   `--harness none --once` for a fact-only brief).
2. Stop the nudge: set `judge.desired` to `"optional"` (product default), or set
   `judge.warnIfOffline` to `false`, in `~/.claude/agentic-sage/config.json`.
3. Ignore it — CLI facts (`board`, `territory`, `merge-brief`) work without a
   live judge.

Config shape: [Configuration](./configuration.md). Recipe: [Live judge](../recipes/live-judge.md).

---

## Session-start nudge appears on every new session

**What you see** at SessionStart (hook inject), same line as above, often
prefixed:

```text
sage: live judge preferred · offline — run: sage judge run
```

At most **two** soft lines are injected per SessionStart (priority: preferred
offline → fleet peers → wired freshness). The preferred-offline line is
recomputed **every** SessionStart while the desire is unsatisfied — so a desk
with `desired: "preferred"` and no live judge will print it again and again.

**What it means:** not a stuck hook loop by itself; the preference is still
unsatisfied. The emitter is fail-open (never blocks the session).

**Fix:** same as [Live judge preferred but offline](#live-judge-preferred-but-offline)
— run a judge, or turn the preference off. Confirm with `sage gate` outside a
hook: if the line still prints, the config still wants preferred.

---

## A session does not show on the board

**What you see:**

```text
$ sage board
SAGE · <repo_id> · 0 sessions
  (no sessions)
```

or outside a git checkout:

```text
$ sage board
sage: not a git repo — try 'sage war' for the fleet view
```

or a live-first board that only shows peers you expect while yours is missing
from the live fold (it may be under `▸ archive (N)` because it is dead/closed).

**Common causes and fixes:**

| Cause | How to confirm | Fix |
|-------|----------------|-----|
| Never registered | No file under the storage `sessions/` dir | `sage register --sid <id> --pid $$ …` or let the harness hook create the record |
| Wrong storage root | `sage where` shows an unexpected `storage` / `matched` rule | Unset `SAGE_STORAGE_ROOT`, or use the same root the other sessions used |
| Wrong repo cwd | `sage where` → `not a git repo` | `cd` into the judged checkout (main worktree or its worktree) |
| Dead / closed | `sage board --all` or `sage board --json` → `liveness: dead` / closed | Re-register, or open a new session; old rows fold into archive |
| Looking at wrong machine state | `sage where` path does not match where you registered | Align `HOME` / storage; see [State directory in an unexpected place](#state-directory-in-an-unexpected-place) |

Empty-board example under a deliberate empty storage root:

```text
$ SAGE_STORAGE_ROOT=/tmp/elsewhere sage where
sage: this repo
  scope     global
  storage   /tmp/elsewhere/repos/<repo_id>
  matched   env (SAGE_STORAGE_ROOT)

$ SAGE_STORAGE_ROOT=/tmp/elsewhere sage board
SAGE · <repo_id> · 0 sessions
  (no sessions)
```

Use `sage board --wide` or `sage board --json` when you need session ids, not
only branch names.

---

## Two sessions look like one

**What you see** (default board columns are branch-first; no sid column):

```text
$ sage board
SAGE · <repo_id> · 2 sessions

● main ✎  idle  bin/ +4
● main ✎  idle  bin/ +4
```

That is **two** session records on the **same branch** (common when two agents
share a worktree or both registered with the same git HEAD). They are not
merged into one record. Branch name and dirt marker (`✎`) vary by checkout.

**Fix — show ids:**

```text
$ sage board --wide
SAGE · <repo_id> · 2 sessions

● main ✎  idle  bin/ +4    beta
● main ✎  idle  bin/ +4    alpha
```

Or `sage board --json` and read each object’s `session_id` / `pid` /
`claimed_globs`. For territory and claims, always set a distinct
`SAGE_SELF_SID` (or a distinct `--pid` lineage) per agent so self-resolution
does not grab the wrong record.

---

## Stale claim from a dead session

**What you see on the board:** a dead pid folds out of the live list:

```text
$ sage board
SAGE · <repo_id> · 1 live · 1 archive

  BRANCH              STATUS  ZONE     AGE
● <branch> ✎          idle    …
▸ archive (1)
```

JSON still has the dead row (`liveness: "dead"`, `alive: false`) until pruned.
**Territory and merge-brief ignore dead/closed peers**, so a claim left on a
dead record does **not** block peers:

```text
$ SAGE_SELF_SID=live-one sage territory 'lib/**'
SAGE territory · lib/**
  clear — no other session claims or touches this
```

**If you still want the file gone from disk:**

```text
$ sage prune
sage: would prune N session(s) older than 7d:
  dead   <sid8>  <branch>
  closed <sid8>  <branch>
sage: re-run with --yes to delete
```

```text
$ sage prune --yes
sage: pruned N session(s)
```

Default age is **7** days for this-repo prune. Fresh dead sessions (minutes old)
will not appear until they age past the threshold.

**Known limitation:** `--days 0` does **not** mean “everything.” The CLI uses
`Number(x) || 7`, so `0` falls back to **7**. Same pattern for fleet
`--older-than 0` → **14**. See [CLI reference · prune](./cli.md).

To stop a live session intentionally: `sage register close --sid <id>` (or
`sage unlink <id>`, which marks the session closed). Claims on closed/dead
rows stay on the JSON file until prune deletes the file; they do not count in
territory.

---

## State directory in an unexpected place

**What you see:**

```text
$ sage where
sage: this repo
  scope     global
  storage   ~/.claude/agentic-sage/repos/<repo_id>
  matched   built-in (default)
```

or with an env override:

```text
$ sage where
sage: this repo
  scope     global
  storage   <SAGE_STORAGE_ROOT>/repos/<repo_id>
  matched   env (SAGE_STORAGE_ROOT)
```

Doctor’s **scope + storage** row always reports `ok` and explains the rule:

```text
  ✓ scope + storage — global · <dir> · via built-in
  ✓ scope + storage — global · <dir> · via env
```

**What it means:** scope (where hooks are wired) and storage (where session
JSON lives) are independent. Precedence is env → in-repo marker → registry →
global default → built-in → legacy. Full chain:
[`CONVENTIONS.md`](../../CONVENTIONS.md).

**Fix:**

1. Run `sage where` and `sage init --show` in the same cwd you work in.
2. If `matched   env (SAGE_STORAGE_ROOT)` was accidental, unset
   `SAGE_STORAGE_ROOT` and re-check.
3. Project-scope installs default storage under `<repo>/.agentic-sage` unless
   you passed `--storage sibling|agent-home` at init.
4. Missing storage dir is a doctor **✗** with `→ run: sage init --repair`.
   That command creates the resolved per-repo data directory when cwd is the
   git repo (empty is enough for ✓). First `sage register` also creates it.

---

## `error: no nvm Node >= 24` (exit 127)

**What you see** when a **PATH `node` shim** looks for Node under
`$HOME/.nvm` / `$NVM_DIR` and the tree is missing (typical: hermetic test
`HOME`, or a clean temp home):

```text
error: no nvm Node >= 24
```

Exit **127**. Product code never ran.

**What it means:** a **desk / harness artifact**, not a SAGE product defect.
Some developer machines put a version-manager shim first on `PATH`. With a
temporary `HOME` that has no nvm install, bare `node …` children die before
they reach `bin/sage`.

**What to do:**

| Audience | Action |
|----------|--------|
| Day-to-day user | Use a real Node ≥ 20 on `PATH` (install/activate nvm Node, or a system Node). SAGE itself requires **Node ≥ 20**. |
| Test / CI author | Spawn suite children with `process.execPath` (this repo exports `NODE` from `test/helpers.mjs`). Never bare `"node"` under hermetic `HOME`. |
| Someone reading suite failures | Do **not** “fix SAGE” by hardcoding nvm paths into product code. Fix the harness. |

More detail: [Safety · hermetic HOME](./safety.md#contributor-note-hermetic-home-and-processexecpath).

---

## Install looks broken (`sage doctor` red rows)

Empty `HOME` (no install) — exit still **0**:

```text
$ sage doctor
SAGE doctor · HEALTH 5/11 █████░░░░░ 45%
  ✗ sage home — ~/.claude/agentic-sage
      → run: sage init
  ✗ global config — missing (default OFF)
      → run: sage init
  ✗ emitter hook — not installed (run install.mjs)
      → run: sage init --repair
  ✗ settings wiring — 0 hook(s) reference sage-emit (Claude + Grok compat)
      → run: sage init --repair
  ✗ skills linked — missing: sage-fleet, sage-doctor, sage-judge (run install.mjs)
      → run: sage init --repair
  ✓ token-forecast — not configured (optional)
  ✓ current repo — <repo_id>
  ✗ storage dir — missing (~/.claude/agentic-sage/repos/<repo_id>)
      → run: sage init --repair
  ✓ scope + storage — global · … · via built-in
  ✓ project adapter — present (…) or none (core-only — fine)
  ✓ live judge — optional — …
  5 ok · 6 need attention
```

**Fix:** `sage init` (or `sage init --repair`), then `sage on` or `sage enable`
as appropriate. Full checklist below.

---

## `sage doctor` — every check (today)

`sage doctor` validates the install for the current machine + cwd. It prints a
health banner, one row per check, and a verdict line. **Writes nothing.**

### Happy path (healthy desk)

```text
$ sage doctor
SAGE doctor · HEALTH 13/13 ██████████ 100%
  ✓ sage home — ~/.claude/agentic-sage
  ✓ global config — enabled
  ✓ emitter hook — ~/.claude/hooks/agentic-sage-emit.mjs
  ✓ settings wiring — N hook(s) reference sage-emit (Claude + Grok compat)
  ✓ skills linked — sage-fleet, sage-doctor, sage-judge
  ✓ grok wiring — ~/.grok/hooks/agentic-sage.json
  ✓ token-forecast — not configured (optional)
  ✓ current repo — <repo_id>
  ✓ storage dir — ~/.claude/agentic-sage/repos/<repo_id>
  ✓ scope + storage — global · <dir> · via built-in
  ✓ project adapter — present (<repo>/.agentic-sage/adapter.mjs)
  ✓ live judge — preferred · offline — run: sage judge run
  ✓ user-scope wiring — clean
  13 ok · 0 need attention
```

(If `~/.grok` is absent, the **grok wiring** row is omitted and the denominator
is **12**, not 13.)

### Check catalogue

| Check | When is it ✗? | Always-✓ informational? | Typical fix line |
|-------|---------------|-------------------------|------------------|
| **sage home** | No directory at `~/.claude/agentic-sage` (legacy `~/.claude/sage` alone is still ok, with a migrate hint) | no | `sage init` |
| **global config** | No readable `config.json` | no — but `enabled` vs `disabled` are both ✓ | `sage init` |
| **emitter hook** | No symlink `~/.claude/hooks/agentic-sage-emit.mjs` (legacy `sage-emit.mjs` still ✓) | no | `sage init --repair` |
| **settings wiring** | Zero hooks whose command contains `sage-emit` | no | `sage init --repair` |
| **skills linked** | Missing any of `sage-fleet`, `sage-doctor`, `sage-judge` under `~/.claude/skills` | no | `sage init --repair` |
| **grok wiring** | Only if `~/.grok` exists: hook file missing, invalid, or emitter path missing | no | `sage init --global --harness both` |
| **token-forecast** | Configured path absent | Unconfigured is ✓ (`not configured (optional)`) | create path or unset `tokenForecastPath` |
| **current repo** | Cwd is not inside a git repo | no | `cd` into a judged repo |
| **storage dir** | Resolved data dir missing on disk | Outside git: forced ✓ `n/a` | `sage init --repair` |
| **scope + storage** | never fails | **yes** — always ✓; explains rule | — |
| **project adapter** | never fails | **yes** — absent is `none (core-only — fine)`; atlas vault may add a soft hint | optional adapter |
| **live judge** | never fails | **yes** — preferred-offline is still ✓ | `sage judge run` (soft) |
| **user-scope wiring** | See [User-scope wiring](#user-scope-wiring-fragile-links) — one row per finding, or a single ✓ when clean / no `~/.claude` | skip-when-absent is ✓ | condition-specific (below) |

Failed rows print a second line: `→ run: <command>` (or a concrete fix description).

### User-scope wiring (fragile links)

`sage doctor` also scans **`<HOME>/.claude`** (hooks, skills, and `settings.json`
commands) for paths that break under everyday fleet hygiene — worktree cleanup
and Node version switches. The scan is **read-only** and **fail-open**: missing
`~/.claude`, unreadable files, or malformed JSON yield one line and the rest of
doctor continues. Doctor never repairs, moves, or deletes user config.

| Condition | Mark | Meaning | Typical fix |
|-----------|------|---------|-------------|
| **dangling** | ✗ | Symlink under `~/.claude/hooks` or `…/skills` whose target does not exist | Remove the link or repoint it; then `sage init --repair` from a **stable** install (main checkout or package path) |
| **wired-missing** | ✗ | A path in a `settings.json` hook `command` that does not resolve on disk (plain file or broken link) | Create the file, fix the command path, or `sage init --repair` |
| **worktree** | ⚠ | Target (or command path) contains a `worktrees/` segment — deleted when that branch’s worktree is removed | Relink to the main repo root or installed package path; prefer `sage init --repair` from main |
| **nvm-pinned** | ⚠ | Target lives under `.nvm/versions/node/<version>/` — breaks on the next Node upgrade | Relink outside the nvm version tree (stable checkout or a version-agnostic install) |
| **settings-malformed** | ⚠ | `settings.json` is not valid JSON — command scan skipped | Fix or restore `~/.claude/settings.json` |
| clean / no `~/.claude` | ✓ | Nothing fragile found, or user-scope dir absent | — |

**Severity is honest:** a dangling *wired* hook is broken *now* (✗). A
worktree-targeted link that still resolves is a *latent* risk (⚠) — doctor does
not print both marks for the same path. Latent rows still count as “need
attention” so the desk sees them before the next worktree prune.

Install itself no longer creates worktree-targeted emitter/skill links: `wireAll`
/ `wireProject` stabilize the package root to the main git checkout when the
source path is a linked worktree.

### Exit behaviour (today vs intent)

| Behaviour | Intended fleet shape | **What exists today** |
|-----------|----------------------|------------------------|
| Severity tiers | Separate tiers for *broken* vs *suboptimal* | Soft policy (preferred judge offline, missing optional adapter) stays **ok: true**. User-scope **latent** risks use **⚠** with `ok: false`; **broken** paths use **✗**. |
| Exit code | Nonzero only on hard failure | **Always exit 0** — including a fully red install. Confirmed by CLI wiring (`bin/sage` only `console.log`s the render) and tests. |
| Machine output | `--json` mode | **`--json` is ignored.** `sage doctor --json` prints the same human checklist as without the flag. (Other verbs such as `board` / `fleet` / `war` do have real `--json` envelopes.) |

Verdict line format (always):

```text
  N ok · M need attention
```

Banner:

```text
SAGE doctor · HEALTH <ok>/<total> <gauge> <pct>%
```

Marks: **✓** ok, **✗** broken, **⚠** latent risk (user-scope worktree / nvm /
malformed settings). A desk can still be mostly green while preferred-offline
text appears on the live-judge **detail** string.

### Related commands

| Command | Role |
|---------|------|
| `sage gate` | Soft control-plane check; preferred-offline warn; `--strict` for install/freshness only |
| `sage where` / `sage init --show` | Storage + scope resolution |
| `sage board --wide` | Human roster with session id tails |
| `/sage-doctor` skill | Runs `sage doctor` and summarises for the agent |

---

## Related

- [CLI reference](./cli.md)
- [Configuration](./configuration.md)
- [Safety](./safety.md)
- [Claims and territory](../concepts/claims-and-territory.md)
- [Dogfood verdict vocabulary](../recipes/dogfood.md#dogfood-verdict-vocabulary)
- [Getting started](../getting-started.md)
