# SAGE machine-readable output — schema 1

`sage board --json` and `sage fleet --json` print exactly one JSON document to
stdout and exit 0, even when the repo has no sessions or the cwd is not a
judged repo (fail-open: empty envelope). Nothing else is written to stdout.

Evolution policy: schema 1 fields are stable; new fields may be ADDED without
a version bump; removals or renames bump `schema`. Consumers must ignore
unknown fields.

## Envelope

| Field | Type | Notes |
|---|---|---|
| `schema` | number | `1` |
| `kind` | string | `"sage.board"` or `"sage.fleet"` |
| `generated_at` | string | ISO-8601 UTC (with milliseconds) |
| `repo_id` | string\|null | `<basename>-<sha256-8>` of the main repo root; `null` outside a repo |
| `self_sid` | string\|null | fleet only — the calling session id (when `resolveSelfSid` succeeds); otherwise `null` |
| `sessions` | array | session objects (newest `updated_at` first) |

## Session object

Fields written by the emitter/CLI; absent means never set for that session (no null-backfilling). Derived fields from `collectSessions` (`alive`, `liveness`, `handoff_bucket`, `handoff_age`) are always present.

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | harness session id; always present (backfilled from the record filename if a legacy record body omitted it). |
| `repo_id` | string | as above |
| `worktree` | string | cwd at SessionStart (worktree path for linked worktrees) |
| `branch` | string\|null | git branch at last git-signal refresh |
| `head` | string\|null | commit sha |
| `dirty` | boolean | uncommitted changes present |
| `touched_globs` | string[] | paths changed vs trunk |
| `trunk` | string\|null | detected trunk branch |
| `pid` | number | harness process id, when resolvable |
| `pid_start` | string\|undefined | `/proc/<pid>/stat` starttime at SessionStart (Linux); makes liveness recycle-proof. Absent on non-/proc platforms or legacy records. |
| `alive` | boolean | derived: pid re-probed at read time (always present); with `pid_start`, requires starttime match |
| `link_state` | string | `scoping` \| `linked` \| `closed` |
| `source` | string\|null | harness-reported session source (`new`, `clear`, `startup`, `compact`, `resume`, …) |
| `status` | string | `active` \| `closed` |
| `liveness` | string | derived: `working` \| `idle` \| `stalled` \| `dead` \| `closed` (always present) |
| `managed_by` | string\|undefined | provenance: `human` \| `nested` (armory/`SAGE_PARENT` or process-tree). Absent on pre-provenance records. |
| `parent_sid` | string\|undefined | when nested via `SAGE_PARENT` tag — parent session id. Absent when human or tree-classified without a sid. |
| `window_name` | string\|undefined | tmux window name at SessionStart ("the name you gave it") |
| `opened_at` / `updated_at` | string | ISO-8601 |
| `last_prompt_at` / `last_tool_at` / `handoff_at` | string\|null | ISO-8601, event stamps (absent until observed) |
| `handoff_path` | string\|null | PreCompact handoff sidecar path (absent until observed) |
| `phase` | string\|undefined | richer activity state (additive; e.g. `compacting` set by emitter on PreCompact, cleared on PostCompact). Absent until observed. When `compacting`, `liveness` derives as `working` (still "hot" for collision awareness and counts). |
| `handoff_bucket` / `handoff_age` | string | derived at read time (always present): bucket is `none`\|`fresh`\|`aging`\|`stale`; age is `—` or e.g. `3m` |
| `claimed_globs` | string[] | via `sage claim` (absent until claimed) |
| `claimed_row` | string | via `sage backlog claim` (absent until claimed) |
| `row` | string | adapter-resolved backlog row (board enrichment only; absent with no adapter or on fleet) |
| `tmux` | string | tmux pane id (board enrichment, pid-based; absent when no match or on fleet) |

**Live-only collision surface.** `sage territory`, `sage why-diverged`, and `sage merge-brief` consider only sessions whose `liveness` is `working` \| `idle` \| `stalled`. Dead/closed history is storage — it must not cry wolf.

## Examples

    sage board --json | jq -r '.sessions[] | "\(.liveness)\t\(.branch)\t\(.session_id)"'
    sage fleet --json | jq '.sessions | map(select(.session_id != .self_sid))'  # (note: .self_sid is top-level on fleet envelope)

A minimal board envelope (seeded session, no adapter, inside a repo):

```json
{
  "schema": 1,
  "kind": "sage.board",
  "generated_at": "2026-07-10T18:00:46.736Z",
  "repo_id": "sage-repo-...",
  "sessions": [
    {
      "session_id": "json-s1",
      "repo_id": "...",
      "worktree": "/path/to/worktree",
      "branch": "main",
      "head": "...",
      "dirty": false,
      "touched_globs": ["src/foo.ts"],
      "trunk": "main",
      "pid": 1234,
      "link_state": "scoping",
      "source": null,
      "status": "active",
      "opened_at": "...",
      "updated_at": "...",
      "last_prompt_at": "...",
      "last_tool_at": "...",
      "handoff_at": null,
      "handoff_path": null,
      "phase": "compacting",
      "claimed_globs": ["src/**"],
      "claimed_row": "A1",
      "alive": true,
      "liveness": "working",
      "handoff_bucket": "none",
      "handoff_age": "—",
      "tmux": "muslewski-2:0"
    }
  ]
}
```

Non-repo (fail-open) or empty:

```json
{ "schema": 1, "kind": "sage.board", "generated_at": "...", "repo_id": null, "sessions": [] }
```

Fleet adds `"self_sid": "..." | null` at the top level of the envelope.

### `sage.war` (from `sage war --json`)

Cross-repo roll-up — the seed of the Hermes machine layer.

```json
{
  "schema": 1,
  "kind": "sage.war",
  "generated_at": "<iso8601>",
  "repos": [{ "repo_id": "<id>", "sessions": [ /* board session rows */ ] }],
  "totals": {
    "repos": 0,
    "sessions": 0,
    "live": 0,
    "working": 0,
    "contested": 0,
    "compacting": 0,
    "human": 0,
    "nested": 0
  }
}
```

`totals.sessions` is the on-disk record count (including dead/closed).
`live` / `working` / `human` / `nested` / `compacting` / `contested` are **live-first**:
human and nested count only live sessions; contested is the sum of live-only
`mergeBrief` path counts across repos (dead/`/clear` ghosts do not contribute).
`sessions` rows use the same shape as `sage.board` (incl. optional `phase`,
`managed_by`, `window_name`, …); `session_id` is always present.

Verify keys against live output in a sandbox before relying on any field.
