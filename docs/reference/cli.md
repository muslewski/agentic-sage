---
title: "CLI reference"
description: "Every sage verb: purpose, verified flags, writes, exit codes, and examples — grouped by task."
section: reference
order: 10
---

# CLI reference

**SAGE** (`sage` / `agentic-sage`) is a passive fleet judge for parallel AI
coding sessions. This page is the full verb map. Day-one users only need the
PRIMARY list from `sage` with no arguments.

Binary names: **`sage`** · **`agentic-sage`** (same entry). Requires **Node ≥ 20**.

When this page and the binary disagree, **the binary wins**. Output below was
captured with `node bin/sage` under a temporary `HOME`.

## How to get help

```bash
sage                 # curated PRIMARY index + happy path + Also list
sage wat             # unknown verb → same usage dump (exit 0)
```

There is no separate `sage help` verb. Subcommands print their own usage when
required flags are missing (often exit **2** for register/claim/link; several
other verbs print usage and still exit **0** — see each verb).

## Happy path

After install (`sage init`) and `sage on` (or `sage enable` in a project):

```bash
sage register --sid worker --pid $$ --lane feature --by me --kind worker
# → sage: registered worker on <repo_id>

SAGE_SELF_SID=worker sage claim 'src/**'
# → sage: claimed src/** on worker

sage board
# → SAGE · <repo_id> · 1 session
#   ● <branch>  idle

SAGE_SELF_SID=worker sage territory 'src/**'
# → clear — no other session claims or touches this

SAGE_SELF_SID=worker sage merge-brief
# → 0 contested path(s) / no contested paths — clear to merge
```

On macOS (no `/proc`) or hermetic shells, always set `SAGE_SELF_SID` for
`claim` and consult verbs. Pid-walk only works when the process registered with
`--pid` is still the current shell lineage.

Concepts: [Claims and territory](../concepts/claims-and-territory.md).

---

## Install and enable

### `sage init`

Wire hooks and skills. Seeds config **disabled** unless you pass `--enable`.

| Flag | Effect |
|------|--------|
| (none, TTY) | Interactive wizard |
| (none, non-TTY) | Safe default: global scope, harness claude, **enable false** |
| `--global` | Wire user-level Claude settings/hooks/skills |
| `--project` | Wire this repo only |
| `--repair` | Re-assert wiring without inventing new policy |
| `--show` | Print resolved scope, harness paths, storage, enablement (no wire) |
| `--enable` | Opt in while wiring |
| `--storage <mode>` | Project storage: `repo-root` \| `sibling` \| `agent-home` |
| `--harness <name>` | `claude` (default), `grok`, or `both` |
| `--path <dir>` | Project path (with `--project`) |

**Writes:** hook symlink, skill links, settings merge, optional config under
`~/.claude/agentic-sage/` (or project storage).

**Exits:** `0` on success; unknown flag prints `sage: unknown flag …` plus the
top-level usage.

```text
$ sage init --show
SAGE — full breakdown
  Scope
    repo       repo (<repo_id>)
    scope      global
  …
  Enablement
    global     disabled
    repo       not set (inherits scope default)
```

### `sage on` / `sage off`

Global master switch. Writes `~/.claude/agentic-sage/config.json` → `enabled`.

```text
$ sage on
SAGE globally enabled
$ sage off
SAGE globally disabled
```

Exit **0**. Independent of per-repo `enable` / `disable`.

### `sage enable` / `sage disable`

Per-repo enable override in the current git checkout. Outside a git repo:

```text
$ sage enable
sage: not a git repo
```

(exit **0** today). Inside a repo:

```text
$ sage enable
sage: enabled for repo (scope: global)
```

### `sage where`

Print this repo’s resolved scope, storage directory, and matched rule.

```text
$ sage where
sage: this repo
  scope     global
  storage   ~/.claude/agentic-sage/repos/<repo_id>
  matched   built-in (default)
```

**Writes:** nothing. Exit **0**.

### `sage adapter init`

Scaffold `.agentic-sage/adapter.mjs` from the template. Refuses to overwrite.

```text
$ sage adapter init
sage: scaffolded .agentic-sage/adapter.mjs from the template
  → edit it to teach SAGE your repo's vocabulary (see ADAPTERS.md)
  → it's committable; or symlink it out-of-tree to ~/.claude/agentic-sage/repos/<id>/adapter.mjs
```

Second run: `sage: .agentic-sage/adapter.mjs already exists — edit it (won't overwrite)`.

---

## Registering and identifying a session

### `sage register`

Launcher-side session declaration (contract C4). Any process can push a record
without a harness hook.

**Open (default):**

```text
usage: sage register --sid <id> [--pid <n>] [--cwd <path>] [--parent <sid>]
       [--kind …] [--lane …] [--fleet-run …] [--corr …] [--by …] [--json]
```

| Flag | Role |
|------|------|
| `--sid <id>` | Required. Filename-safe token (`^[A-Za-z0-9._@+=:-]+$`, length 1–200) |
| `--pid <n>` | Live PID for liveness / self-resolution |
| `--cwd <path>` | Repo root override (default: process cwd) |
| `--parent <sid>` | Parent session id (launcher → child) |
| `--kind …` | e.g. `worker`, `launcher` |
| `--lane …` | Free-text lane label (board rollup) |
| `--fleet-run …` | Fleet-run correlation id |
| `--corr …` | Correlation id |
| `--by …` | Who registered (stored as `registered_by`) |
| `--json` | Machine result on stdout |

**Subcommands:**

```text
sage register heartbeat --sid <id> [--cwd <path>] [--json]
sage register close --sid <id> [--cwd <path>] [--result ok|failed|partial] [--json]
```

**Writes:** `~/.claude/agentic-sage/repos/<repo_id>/sessions/<sid>.json`
(creates or merges). Heartbeat refreshes timestamps; close sets closed status.

**Exits:**

| Code | When |
|------|------|
| **0** | Success |
| **1** | Soft-fail (store/env/reason from library) |
| **2** | Missing `--sid`, or path-shaped unsafe sid (`/`, `\`, `../`) |

```text
$ sage register --sid worker-a --pid $$ --lane feature --by me --kind worker
sage: registered worker-a on <repo_id>

$ sage register --sid worker-b --pid $$ --json
{"ok":true,"sid":"worker-b","repo_id":"<repo_id>"}

$ sage register heartbeat --sid worker-a
sage: heartbeat worker-a on <repo_id>

$ sage register close --sid worker-b --result ok
sage: closed worker-b on <repo_id>

$ sage register
usage: sage register --sid <id> …
# exit 2

$ sage register --sid '../escape'
sage: register soft-fail — unsafe session id
# exit 2
```

Launchers that want fire-and-forget often append `|| true`.

### `sage link` / `sage unlink`

Manual `link_state` override for an existing session id.

```text
usage: sage link <session_id> [state]    # default state: linked
usage: sage unlink <session_id>
```

```text
$ sage link worker-a
sage: linked worker-a (linked)
$ sage unlink worker-a
sage: unlinked worker-a
```

**Exits:** **2** missing sid or unsafe sid; **1** not a git repo or library
error; **0** success.

### Self resolution

Verbs that need “this session” (`claim`, judge role, some consult stamps) resolve
self in order:

1. Open session record matching pid-walk from the current process
2. Else `SAGE_SELF_SID`

Unsafe path-shaped ids are refused.

---

## Claiming and inspecting territory

### `sage claim <glob…>`

Write **this** session’s `claimed_globs` (intent, not git dirty).

```text
usage: sage claim <glob> [glob…]
```

There is **no** `claim --help`. A lone `--help` is stored as a literal glob.

**Writes:** merges `claimed_globs` + `link_state: linked` on the self record.

**Exits:**

| Code | When |
|------|------|
| **0** | Claimed |
| **1** | Not a git repo; cannot resolve self; no open record; closed session; judge role; merge failure |
| **2** | No globs; unsafe `SAGE_SELF_SID` |

```text
$ SAGE_SELF_SID=worker-a sage claim 'src/**'
sage: claimed src/** on worker-a

$ SAGE_SELF_SID=worker-a sage claim
usage: sage claim <glob> [glob…]
# exit 2

$ SAGE_SELF_SID=closed-sid sage claim 'x/**'
sage: session closed-sid is closed — cannot claim on a closed session
# exit 1
```

### `sage territory <glob…>`

Who **else** (live, non-judge, non-synthetic) claims or touches the given globs.

```text
usage: sage territory <glob> [glob…]
```

**Writes:** nothing (may stamp “asking” breadcrumb). Exit **0** even when usage
is printed for missing globs (today).

```text
$ SAGE_SELF_SID=session-a sage territory 'src/auth/**'
SAGE territory · src/auth/**
  <branch>             claimed  idle     src/auth/**

$ SAGE_SELF_SID=session-a sage territory 'lib/unrelated/**'
SAGE territory · lib/unrelated/**
  clear — no other session claims or touches this
```

### `sage why-diverged <file>`

Which other live sessions touch a concrete file (optional git numstat context).

```text
usage: sage why-diverged <file>
```

```text
$ sage why-diverged README.md
SAGE why-diverged · README.md
  no other session touches this file
```

Exit **0** (including bare usage with no file).

### `sage backlog` / `sage backlog claim <row>`

Adapter-gated. Without a `backlogRows` adapter:

```text
$ sage backlog
sage: no backlog adapter for this repo
```

Claim a row (shape `^[A-Za-z]\d{1,6}$`, e.g. `D11`):

```text
usage: sage backlog claim <row>   (e.g. D11)
```

Writes `claimed_row` on self. Bad row shape prints usage (exit **0** today).

---

## Asking about merge safety

### `sage merge-brief`

Lists paths that **two or more other live sessions** have touched or claimed
(self excluded when resolved; judges and synthetic agent-status rows ignored).

**Writes:** nothing (asking stamp only). Exit **0**.

```text
$ SAGE_SELF_SID=sess-a sage merge-brief
SAGE merge-brief · <repo_id> · 0 contested path(s)
  no contested paths — clear to merge
```

With three live peers all claiming `src/**` (caller is one of them):

```text
SAGE merge-brief · <repo_id> · RISK █░░░ low · 1 contested path(s)
  src/**  █░░░ low  ██
    contested by: <branch>, <branch>
```

Without self resolution, every live claimant counts (risk can read higher).

**Known limitation (two-worker desk):** if only you and one peer claim the same
path, and self is resolved, `merge-brief` prints **clear to merge** (only one
*other* session). Use **`sage territory`** for pairwise “is anyone else on
this?”. Full table: [Claims and territory](../concepts/claims-and-territory.md).

TTY + `fzf` may open a path drill-in when there are contested paths; cancel or
missing `fzf` falls through to the full text brief.

---

## Seeing the fleet

### `sage board`

Per-repo session roster.

| Flag | Effect |
|------|--------|
| `--watch` | Live refresh on a TTY (static frame if piped) |
| `--wide` / `-w` | Wider columns (includes truncated session id) |
| `--all` | Expand archive / closed rows |
| `--flat` | Disable LIVE lane rollup grouping |
| `--json` | Machine envelope (`kind: "sage.board"`) |

`--json` and `--watch` together → error, exit **1**:

```text
sage: --json and --watch are mutually exclusive
```

Outside a git repo: human message suggests `sage war`; JSON returns empty
sessions with `repo_id: null`.

```text
$ sage board
SAGE · <repo_id> · 2 sessions

● master  idle
● master  idle
```

After one close (live-first; archive folded):

```text
SAGE · <repo_id> · 1 live · 1 archive

  BRANCH  STATUS  ZONE  AGE
● master  idle
▸ archive (1)
```

`--all` expands the archive. **Writes:** nothing.

### `sage war`

Cross-repo war-room cockpit. TTY → interactive live UI (`?` help, `X` clear
dead, `a` toggle archive). Piped/non-TTY → one static frame.

| Flag | Effect |
|------|--------|
| `--json` | `kind: "sage.war"` fleet snapshot |
| `--wide` / `-w` | Wider layout |
| `--all` | Include archived/orphan rows |

### `sage fleet`

One-line nearest-neighbour HUD for this repo.

```text
$ sage fleet
sage: 2 live · nearest master touches — · ⚖ Asking Sage
```

`--json` → `kind: "sage.fleet"`. Exit **0**. Not a git repo → `sage: not a git repo`.

### `sage repos`

Product/orphan atlas across judged repos. `--all` expands the orphan fold.
TTY + `fzf` may jump into a product repo.

```text
$ sage repos
SAGE repos · 1 product · 0 orphan
  repo      ███░░  live 2    …  (<repo_id> · N session(s))
```

### `sage about --tmux <session> [--json]`

Ferry / navigation one-liner for a tmux session name.

```text
usage: sage about --tmux <session-name> [--json]
```

```text
$ sage about --tmux no-such-session
sage: no session matched tmux 'no-such-session'
```

Missing name prints usage and exits **0** (uses `process.exit(0)`).

---

## The judge and the gate

Offline by default: CLI facts work with no live judge. Optional judge pane
writes narrative briefs only.

### `sage judge status`

```text
$ sage judge status
SAGE judge status
  fleet: (no brief)
  repo:  (no brief)
```

### `sage judge show [--fleet|--repo]`

Print a fresh brief. Default scope is **repo** when cwd is a git repo, else fleet.

```text
$ sage judge show
sage: no fresh repo brief
```

### `sage judge on --fleet | --repo [--takeover]`

Mark **this** session as live judge (needs self + open record).

```text
usage: sage judge on --fleet | --repo [--takeover]
```

`--takeover` steals a held slot and marks the previous brief stale.

### `sage judge off`

Clear judge role on self; mark own brief stale.

### `sage judge publish`

Stdin JSON → atomic brief write. Session must already be `role: judge`.

```text
usage: sage judge publish  < brief.json   (stdin)
```

Invalid JSON → stderr `sage: invalid JSON on stdin`, exit **1**.

### `sage judge run`

Easy path: resolve scope + harness, register judge slot, spawn or fact-only loop.

| Flag | Effect |
|------|--------|
| `--auto` / `--fleet` / `--repo` | Scope (default from config or auto) |
| `--harness auto\|grok\|claude\|none` | Agent binary or fact-only keeper |
| `--once` | Single fact-only tick when harness is none |
| `--takeover` | Steal judge slot |
| `--print-only` | Print kit + prompt; do not start a harness |

```text
$ sage judge run --print-only --once --harness none
sage: judge run kit · scope=repo · harness=none · sid=judge-<8hex>
  export SAGE_SELF_SID=judge-<8hex>
  …
Prompt for your agent:
You are a SAGE live fleet judge (passive advisor).
…
```

Missing harness binary → exit **1** with a hint to `--harness none` or
`--print-only`.

Recipe: [Live judge](../recipes/live-judge.md).

### `sage gate [--strict] [--check-latest] [--force]`

Soft control-plane check: install freshness + preferred-judge offline warn.

| Flag | Effect |
|------|--------|
| (none) | Soft: print messages or `sage gate: ok`; exit **0** unless policy says otherwise |
| `--strict` | Non-zero on incomplete install / freshness fail |
| `--check-latest` | Allow registry/npm freshness probe |
| `--force` | Force registry path for freshness |

Preferred-judge offline is **always soft** (exit 0).

```text
$ sage gate
sage gate: ok

# empty HOME, no sage home yet:
$ sage gate
sage gate: sage home missing — run: sage init
# exit 0

$ sage gate --strict
sage gate: sage home missing — run: sage init
sage gate: fail (strict) — install/wire incomplete
# exit 1
```

---

## Diagnostics and maintenance

### `sage doctor`

Validate dirs, emitter hook, settings wiring, skills, token-forecast, current
repo, storage, adapter, live-judge optional note. Full check catalogue, fix
lines, and known gaps (always-exit-0, no `--json`, soft rows forced ✓):
[Troubleshooting · sage doctor](./troubleshooting.md#sage-doctor--every-check-today).

```text
$ sage doctor
SAGE doctor · HEALTH 7/11 ██████░░░░ 64%
  ✓ sage home — ~/.claude/agentic-sage
  ✗ global config — missing (default OFF)
      → run: sage init
  …
  7 ok · 4 need attention
```

Exit **0** even when checks need attention (today). **`--json` is ignored**
(same human checklist). **Writes:** nothing.

### `sage prune`

Drop old closed/dead session records.

| Mode | Flags | Default age | Safety |
|------|-------|-------------|--------|
| This repo | `[--days N] [--yes]` | **7** days | Without `--yes`: list candidates, do not delete |
| Fleet-wide | `--all [--older-than <d>] [--dry-run] [--yes] [--json]` | **14** days when `--all` and no age flag | Without `--yes`: dry-run (also forced by `--dry-run`) |

Both `--days` and `--older-than` are accepted; `--older-than` wins if both are
present. Legacy help listed two prune lines; behaviour is one verb with two
modes.

```text
$ sage prune --dry-run
sage: nothing to prune (no closed/dead sessions older than 7d)

$ sage prune --all --dry-run
sage: would prune fleet-wide — repos 0, sessions 0, events 0, dirs 0 (dry-run; pass --yes to delete)

$ sage prune --all --dry-run --json
{"repos":0,"sessions":0,"events":0,"dirs":0}
```

**Known limitation:** `--days 0` and `--older-than 0` are treated as the flag’s
fallback default (**7** / **14**) because the CLI uses `Number(x) || default`.
You cannot ask for “everything older than zero days” with those flags today.

### `sage telemetry …`

Local debug event stream. **Default OFF.** Never required for product use.

```text
usage: sage telemetry status|report|dump|clear|on|off
```

```text
$ sage telemetry status
sage telemetry: OFF · events=0 · ~/.cache/agentic-sage/events.jsonl
```

See [Developer logging](./developer-logging.md).

### `sage statusline [--session <sid>] [--cwd <path>]`

Print the “Asking Sage” segment only while a consult is fresh **and** SAGE is
enabled; otherwise print **nothing** (exit **0**). Also reads stdin JSON
(`session_id`, `cwd`) or `CLAUDE_SESSION_ID` / `GROK_SESSION_ID`.

### `sage guard …`

Optional path guard. **Default OFF / disarmed.** The only SAGE feature that can
block edits when armed.

```text
list | add <path> | rm <path> | on | off
```

```text
$ sage guard list
SAGE guard · disarmed
  (no contested paths — sage guard add <path>)

$ sage guard add src/auth
sage: guard added src/auth
$ sage guard on
sage: guard ARMED — SAGE will now block edits to contested paths here
$ sage guard off
sage: guard disarmed
```

Do not arm unless the human explicitly wants blocking. See [Safety](./safety.md).

---

## Exit code summary

Many read verbs always exit **0** (including some usage prints). Treat these as
reliable for scripting:

| Area | Codes |
|------|--------|
| `register` | 0 success, 1 soft-fail, 2 usage / path-shaped sid |
| `claim` | 0 / 1 / 2 as above |
| `link` / `unlink` | 0 / 1 / 2 |
| `board --json --watch` | 1 |
| `gate --strict` | 1 on incomplete install / freshness fail |
| `judge run` missing harness | 1 |
| `judge publish` bad JSON | 1 |
| Unknown top-level verb | 0 + usage |

---

## Machine JSON

Board / fleet / war envelopes: [`SCHEMA.md`](../../SCHEMA.md). Prefer
`--json` over scraping human tables.

---

## Proposal: verb collapse (not implemented)

> **Proposal only.** No renames or removals in this pass. Product decision still open.

The human complaint is real: ~25 top-level verbs is more surface than a day-one
desk needs. The PRIMARY list already demotes most of them in **help**. A later
release could also demote them in the **command surface**.

| Idea | Reasoning | Risk |
|------|-----------|------|
| Fold `heartbeat` / `close` under `register` only (already subcommands) — drop any docs that present them as peers of `register` | They are not top-level verbs today; keep teaching one noun | Low |
| Merge `link` + `unlink` → `sage session link\|unlink` or `register --link-state` | Rare manual overrides; pollute day-one memory | Medium (scripts) |
| Merge `enable`/`disable` into `on`/`off` with `--repo` | Two enable axes confuse; one verb with scope flag | Medium (install docs) |
| Merge `where` into `doctor` or `init --show` | Overlap with `--show` and doctor storage lines | Low |
| Demote `why-diverged` to `territory --why <file>` or `merge-brief --file` | Same collision family; third name to remember | Low–medium |
| Demote `repos` to `war --atlas` / `fleet --repos` | Atlas is fleet-scale chrome | Medium |
| Keep `board` vs `war` vs `fleet` but document as zoom levels only | Three views of the same store; names stay | Docs only |
| Fold `gate` into `doctor --gate` or `doctor --strict` | Both are install health; gate is soft control-plane | Medium (desk scripts) |
| Keep `judge *` as one noun (already) | Subcommands are correct | — |
| Keep `guard` / `telemetry` / `statusline` / `about` out of PRIMARY forever | Optional, default-off, or ferry-only | — |
| Collapse dual prune flag names (`--days` vs `--older-than`) to one | Two flags + two defaults (7 vs 14) are hard to remember | Low if both aliases stay |

**Suggested end state (sketch):** ~8 stable verbs (`init`, `on`/`off`,
`register`, `claim`, `board`, `territory`, `merge-brief`, `doctor`) plus
`war`/`judge` for power users; everything else becomes a flag or subcommand.
Do **not** do this without a migration note for agents that already call the
current names.

---

## Related

- [Getting started](../getting-started.md)
- [Claims and territory](../concepts/claims-and-territory.md)
- [Configuration](./configuration.md)
- [Safety](./safety.md)
- [Developer logging](./developer-logging.md)
- [Troubleshooting](./troubleshooting.md) (doctor catalogue, symptoms)
- [Dogfood verdicts](../recipes/dogfood.md#dogfood-verdict-vocabulary)
- Agent install runbook: [`AGENTS.md`](../../AGENTS.md)
- Human setup: [`SETUP.md`](../../SETUP.md)
