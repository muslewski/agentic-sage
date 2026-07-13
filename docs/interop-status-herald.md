# Cross-Project Convention: Session State Between agentic-sage and status-herald

**Projects:** agentic-sage (Sage War Room / fleet judge) and status-herald (curtains, bottom bars, cards).

**Purpose:** Provide a lightweight *observational contract* for the narrow overlap (especially the compaction path) so the two systems do not lie to the human in incompatible ways. This is *not* a partnership or shared implementation mandate. The systems are adjacent tools that observe the same agent hooks; they answer different questions and are allowed (and expected) to differ on many details.

This document is the single source of truth for the *shared vocabulary on the compact/hot path*. It lives primarily here and is mirrored/referenced from `status-herald/docs/interop-status-herald.md`. See also the full deliberation record in `advisor-plans/026-sage-herald-interop-strategy.md`.

**Scope:** Hook-driven state only (UserPromptSubmit, PostToolUse, Stop, Pre/PostCompact, Notification, Subagent*, Session*). Not about territory, claims, handoffs, or token math.

**Invariants (non-negotiable):**
- Both systems are **fail-open** and **default-OFF**.
- PreCompact is always treated as entering a distinct "compacting" face (not DONE).
- PostCompact (or the next idle/Stop signal) drains compacting.
- Additive evolution only (see Versioning).

---

## Expect Divergence (read this first)

These tools answer **different questions**. They will legitimately disagree outside the compact path.

| Concern | Sage (fleet judge) | Herald (per-pane UI) |
|---------|--------------------|----------------------|
| Question | Is this session collision-relevant / hot for the fleet? | What face should *this* pane show the human right now? |
| Authoritative surface | session record + derived `liveness` / `phase` | `@herald_state` + curtain/card stamps |
| Subagents after Stop | Main Stop → `idle` (coarse; ignores subs) | Can stay `WORKING` while inflight subs exist |
| Permission prompts | Usually no dedicated state (may stay prior liveness) | `NEEDS` face |
| Stall judgment | `stalled` after last-tool age | No equivalent; keeps last face until next hook |
| Storage / identity | repo-id + session records (global/project/legacy roots) | tmux opts + harness session id |

**The only tightly shared contract:** for the *same normalized hook sequence on the compact path*, both must enter a distinct compacting face that remains busy/hot and is **never** shown as DONE. Everything else is allowed to differ — and documenting that difference is part of the contract.

Do **not** treat either system as a slave of the other. Optional reads of sage `--json` or herald tmux opts are power-user enrichment, not a partnership requirement. No runtime bridges are shipped (see plan 026).

---

## Canonical States / Phases

**Herald's `STATES` (lib/curtain/state.mjs — authoritative for UI affordance):**

```js
export const STATES = Object.freeze({
  IDLE: "idle",         // Armed, no active turn (initial or fully settled)
  WORKING: "working",   // Actively processing a turn (prompt, tools, live subs)
  COMPACTING: "compacting", // Context compaction in flight (no live output)
  DONE: "done",         // Turn ended; may have background shells left
  NEEDS: "needs",       // Blocked on human (permission/approval prompt or agent_error)
});
```

**Sage's model (lib/liveness.mjs + records — authoritative for fleet judgment):**

- **liveness** (derived on every read; coarse + staleness):
  - `working`
  - `idle`
  - `stalled`
  - `dead`
  - `closed`
- **phase** (optional, additive, on the per-session record; currently only `'compacting'`):
  - Present only during special activity.
  - When `phase === 'compacting'`, `deriveLiveness` forces `'working'` (still hot for collisions).

**Mapping (sage → herald concepts for interop):**

- Sage `liveness === 'working' || phase === 'compacting'` → herald "busy face" territory (WORKING or COMPACTING).
- Sage `phase === 'compacting'` → herald `COMPACTING` (exact match required).
- Sage `liveness === 'idle'` (post-Stop) → herald `DONE` (or `IDLE` before first prompt).
- Sage has no native `NEEDS` (UI-only; a permission prompt may keep a sage session at `working` via prior PostToolUse or until Stop).
- Sage `stalled` is a sage-only judgment of staleness (no herald equivalent; herald keeps its last state until next hook).

**Display faces (herald owns the glyphs/labels/timers; sage surfaces phase for status columns):**
- `IDLE` / sage `idle`: calm, no spinner.
- `WORKING`: elapsed timer + sub counts.
- `COMPACTING`: "compressing context…" (or theme art); distinct from DONE.
- `DONE`: "worked m:ss" + "focus to open" (or bg shells note).
- `NEEDS`: "focus to open" (attention).

---

## "Hot/Busy for Fleet Judgment" vs "UI Affordance"

- **Sage owns coarse hotness** (for collision detection, territory, "N hot" rollups, lead glyphs in war room/board):
  - Used by: `lib/warroom.js` (`isHot`), `lib/fleet.js` (`tally` + `working`), `lib/board.js`, territory/guard relevance, `sage war` / `board` counts.
  - A session is **hot** iff it might be editing things right now or about to.
  - `working` tally **includes** compacting sessions (via `liveness === 'working'`).

- **Herald owns fine turn UI state** (cards, curtains, bottom-bar segments, timers, subagent/shell counts, cover/reveal decisions):
  - `COVERABLE = {WORKING, COMPACTING, DONE, NEEDS}`.
  - `IDLE` is never covered.
  - Elapsed clock, "worked" freeze, bg subagent set (not counter), etc.

**They must agree on the compacting path** but may differ on post-Stop subs (herald can stay WORKING via sub count; sage goes `idle` on Stop — sage's coarse model treats main turn end as non-hot).

**War room (sage) specific display rules (per this convention):**
- STATUS column: `"compacting"` (with `ctx%` if present) or the liveness value. Never lie "idle" or "done" during compact.
- Lead glyph: `◆` (hot) for `liveness==='working' || phase==='compacting'`.
- Panels/rollups: may say "X working" or "X hot" that **rolls in** compacting (consistent with `working` count). Explicit `compacting` count available in `--json` totals.
- Spinner frames apply to hot rows (liveness working).

---

## Event Mapping Table

Both systems normalize event names (Claude snake, Grok camel/Pascal, env fallbacks). The emitter (sage) and `parseHookPayload`/`nextState` (herald) must stay in sync on names.

| Event (normalized)          | Sage emitter action (record)                          | Herald `nextState` / stamp effect                  | Interop Notes / Cooperation Rule |
|-----------------------------|-------------------------------------------------------|----------------------------------------------------|----------------------------------|
| `SessionStart`             | Seed record (pid, branch, liveness:'idle', status active, link_state scoping, etc.) | `arm()` → `@herald_state=IDLE`, reset counts      | Bootstrap. Both start calm. |
| `UserPromptSubmit`         | `liveness='working'`, `last_prompt_at`               | → `WORKING` (and resets elapsed)                  | Starts active turn. |
| `PostToolUse`              | `liveness='working'`, `last_tool_at` (30s throttle)  | → `WORKING` (clears stale NEEDS/COMPACTING/DONE) | Reliable "active again" after approval or bg resume. |
| `Stop`                     | `liveness='idle'`, git signals refreshed             | if `inflightSubagents > 0` → `WORKING` else `DONE` | Sage ends "hot" turn coarsely. Herald preserves sub-driven busy. |
| `PreCompact`               | `phase='compacting'`, `handoff_at`/`path`, event; liveness derives 'working' | → `COMPACTING`                                    | **Must both enter distinct compact face.** Sage auto-handoff + marks for fleet. |
| `PostCompact`              | `phase=undefined` (cleared), `last_tool_at`          | No direct transition (see idle/Stop below)        | Sage drains immediately. Herald waits for next end signal. |
| `Notification` (permission_prompt / approval_required) | None (normalized, falls through)                    | → `NEEDS`                                         | UI attention only. Sage may stay prior state. |
| `Notification` (idle_prompt) | None                                                 | if subs > 0 → WORKING else DONE (unless cur===NEEDS) | Primary end-marker for resumed turns / post-compact. |
| `Notification` (other: task_complete, push, agent_error, etc.) | None | `agent_error` → NEEDS; else leave `cur` unchanged | Never hijack working from info pings. |
| `SubagentStart`            | None (normalized, falls through)                     | Updates sub id set; may drive WORKING via other paths | Count mgmt (herald authoritative). |
| `SubagentStop`             | None                                                 | No state change (return `cur`); update counts     | Authoritative task list on Stop/SubagentStop overwrites. |
| `SessionEnd`               | `link_state='closed'`, `status='closed'`, `liveness='closed'` | (disarm path outside hook)                        | Terminal. |

**Key cooperation rules (both implementations must follow):**
- `PreCompact` → enter `COMPACTING` / `phase='compacting'` (distinct face, still hot).
- `PostCompact` **or** a subsequent `idle_prompt` / `Stop` (no subs) drains compacting → normal idle/DONE.
- `PostToolUse` is the only reliable "resume from block/compact/approval" signal (no explicit "block cleared" event).
- Sub counts: herald uses set + authoritative overwrite from task-bearing events. Sage ignores for its liveness (coarse).
- Unknown events: leave state alone (herald: `return cur`; sage: no-op).

---

## Ownership

- **Sage owns (objective, collision-relevant):**
  - Claims (`claimed_globs`, `claimed_row`), handoff artifacts, territory.
  - Coarse hotness + liveness derivation + phase for compact.
  - Fleet totals, contested paths, board/war render truth.
  - Never writes herald tmux opts.

- **Herald owns (presentation + fine turn):**
  - `@herald_state`, `@herald_since`, `@herald_worked`, `@herald_bg_*` (sub ids as set, shells), `@herald_*` tmux options.
  - Cards, curtains, bars, timers, cover/reveal logic.
  - `nextState` + `stampFromHook`.
  - May **read** sage records / `--json` for enrichment (optional).

**Shared ground:** The hook sequence and the meaning of `PreCompact`/`compacting`. Both observe the same events and must not contradict on "is this session visibly busy right now for fleet purposes."

---

## Display in War Room (sage) + Herald UI

- War room STATUS: exactly `"compacting"` (append ` · XX%` if `ctx_used`/`ctx_window` present on the sage record) or the raw liveness. Lead with `◆` for hot (including compacting).
- Panels: "X hot" / "X working" rolls compacting in (via the `working` count). Separate `compacting` total available in JSON.
- Herald cards: use `COMPACTING` state for dedicated art/text ("compressing context…"). Never show a compacting session as `DONE`.
- When sage `phase` present, herald (if consuming) should prefer or align its state with it for compacting.

---

## Optional Consumption (explicit, experimental — not recommended by default)

Independence is the default. Cross-reads are **opt-in power-user** paths only. Plan 026 deliberately
avoids shipping bridges; anything below is unsupported glue until a follow-up plan + harness exists.

**If herald optionally wants sage judge truth:**
- Prefer `sage board --json` / `fleet --json` / `war --json` (schema 1; `phase`, `liveness`, …).
- Direct record paths under `~/.claude/agentic-sage/…` (or project storage via `sage where`) are
  **unsupported** for external consumers — scope/legacy rules drift.
- Fail-open: missing sage → herald uses its own court only.

**If sage optionally wants herald UI faces (not implemented):**
- Reading `@herald_state` / sub counts via tmux would be additive and best-effort only.
- Pure sage installs must never require herald.

`asking` breadcrumb (for "⚖️ Asking Sage") remains separate and ephemeral.

---

## Versioning / Evolution

- **Additive fields only.** New phases/states, new record keys, new JSON fields on `--json` output, or new notification types are added without bumping schema.
- When a **new phase** is introduced (e.g. future "planning", "review"):
  - Document it here first.
  - Herald adds `STATES.FOO` + handling in `nextState` + render paths.
  - Sage adds `phase` support in `deriveLiveness` (force 'working' for hotness if appropriate) + emitter write + display in board/war.
  - Update the mapping table and pseudocode.
  - Consumers ignore unknown phases (treat as prior equivalent or 'working' for hotness).
- Schema evolution (rare): only for breaking changes; current is `1` (see `SCHEMA.md`).
- Both projects must keep their normalizers in sync for new event spellings.

---

## Independent Operation Guarantees

- Installing/using only sage: full fleet judgment, board, war, claims, guard, statusline all work. Herald state is invisible.
- Installing/using only herald: full cards, curtains, bars, timers work using its own state machine.
- Both present: they observe the same hooks → consistent decisions on compacting + hot. No cross-writes.
- A disabled sage or unarmed herald costs nothing (fast paths).
- Record/tmux option corruption or absence: each degrades gracefully (sage → idle/dead derivation; herald → stays last state or IDLE).

---

## Pseudocode for Key Predicates

**Sage (lib/liveness.mjs + callers):**

```js
// Derive on read (board, war, fleet). Phase is richer activity marker.
function deriveLiveness({ alive, closed, lastToolAt, phase, now = Date.now(), stallMs = 600000 }) {
  if (closed) return 'closed';
  if (phase === 'compacting') return 'working';   // compacting is hot
  if (alive === false) return 'dead';
  if (lastToolAt) {
    const t = Date.parse(lastToolAt);
    return (now - t > stallMs) ? 'stalled' : 'working';
  }
  return 'idle';
}

const isHotForFleetJudgment = (s) =>
  s.liveness === 'working' || s.phase === 'compacting';

const displayStatus = (s) =>
  (s.phase === 'compacting') ? 'compacting' : s.liveness;
```

**Herald (lib/curtain/hook.mjs):**

```js
function nextState(cur, ev, stored = {}) {
  if (!ev) return cur;
  switch (ev.event) {
    case 'UserPromptSubmit':
    case 'SubagentStart':
    case 'PostToolUse':
      return STATES.WORKING;

    case 'PreCompact':
      return STATES.COMPACTING;   // distinct face

    case 'SubagentStop':
      return cur;                 // only refreshes counts

    case 'Stop':
      return inflightSubagents(ev, stored) > 0 ? STATES.WORKING : STATES.DONE;

    case 'Notification': {
      const t = ev.notificationType;
      if (t === 'permission_prompt' || t === 'agent_error') return STATES.NEEDS;
      if (t === 'idle_prompt') {
        if (cur === STATES.NEEDS) return STATES.NEEDS;
        return inflightSubagents(ev, stored) > 0 ? STATES.WORKING : STATES.DONE;
      }
      return cur;  // informational
    }
    default: return cur;
  }
}

const isBusyUI = (state) => state !== STATES.IDLE;  // but coverable is stricter
```

**Interop alignment helper (for tests/docs):**

```js
function agreesOnCompacting(sagePhase, heraldState) {
  const sageComp = sagePhase === 'compacting';
  const heraldComp = heraldState === 'compacting';
  return sageComp === heraldComp;
}

function isFleetHotFromEither(sageLiveness, sagePhase, heraldState) {
  // Sage is source of truth for fleet judgment hotness
  return isHotForFleetJudgment({ liveness: sageLiveness, phase: sagePhase });
}
```

---

## Testing Recommendation

**Golden rule:** Feed the **identical sequence of normalized hook payloads** to both `deriveLiveness`/`collect` (sage) and `nextState` + `stampFromHook` (herald) and assert identical phase/busy decisions for the compact + hot path.

- Unit: `test/emit.test.mjs` + `test/liveness.test.mjs` (sage) and `test/hook.test.mjs` (herald) must cover the shared sequences (including PreCompact → PostCompact drain, PostToolUse clearing COMPACTING, Stop vs subs).
- Integration: replay real recorded hook traces (or synthetic) in a harness test; assert:
  - After PreCompact: sage `phase==='compacting' && liveness==='working'`, herald `COMPACTING`, `isHot` true, card not showing DONE.
  - After PostCompact + idle_prompt/Stop: phase cleared, state DRAINED to idle/DONE, not hot.
  - Subagent-heavy turn: herald may stay WORKING across Stops; sage idles on main Stop (documented divergence).
- E2E: `sage doctor` + `herald curtain doctor` + live session exercising the events; visual check war room vs card.
- Add a shared "contract test" fixture (JSONL of events) runnable from both repos if they live in one workspace.

Run the sequence in both and `assert(agreesOnCompacting(...) && sameHotDecision(...))`.

---

## Adoption Checklist

### For agentic-sage

- [ ] Ensure emitter writes `phase: 'compacting'` on `PreCompact` and clears on `PostCompact` (already true).
- [ ] `deriveLiveness`, `isHot` / `displayStatus` in board/warroom/fleet honor the rules above (already true; keep comments referencing this doc).
- [ ] `--json` output (SCHEMA.md) documents `phase` + `compacting` totals (already).
- [ ] Tests assert the mapping table + pseudocode behaviors.
- [ ] Link this doc from `CONVENTIONS.md`, `README.md`, and `AGENTS.md` (under interop / consumers).
- [ ] When adding a new phase: update this file + mapping + tests + schema note first.
- [ ] `sage doctor` may surface "herald present" as info (optional).

### For status-herald

- [ ] `nextState`, `parseHookPayload`, `stampFromHook` implement the event table + PreCompact rule (already true).
- [ ] `COMPACTING` card render + coverable + drain logic (idle/Stop) match rules.
- [ ] Optional: add consumer for `sage ... --json` (or direct records) to read `phase`/`liveness` for alignment or extra fields (e.g. annotate cards or bars). Fail open.
- [ ] Optional: on arm or stamp, read sage record for initial `phase` if present.
- [ ] Tests include cross-project contract sequences (or import shared fixture).
- [ ] Document consumption in herald README / plans; reference this file.
- [ ] When adding a new phase or notification type: sync the mapping here first.
- [ ] `herald curtain doctor` / inspect may note sage records present (optional).

---

**Maintenance:** Changes to phase semantics, new events that affect hot/compacting, or display rules must update this document + both codebases + tests in the same change set (or coordinated PRs). The "identical hook sequence → same decision" test is the gate.

This convention makes the two systems true siblings: sage judges the fleet objectively; herald gives every tab its face and timer. They agree where it matters without coupling.

---

*Last updated: 2026-07-13 (initial draft per cross-project alignment task). Add entries for future phases here.*
