---
title: "Dogfood layout"
description: "Maintainer fleet shape and the PASS / FAIL / UNVERIFIED / n/a dogfood verdict vocabulary."
section: recipes
order: 20
---

# Dogfood layout

How maintainers run agentic-sage day to day, and how any agent-facing change
must report whether the **real consumer path** was exercised.

Lived friction notes (architecture vault, not product contract):

→ [`agentic-sage-mind/reports/dogfood-log.md`](../../agentic-sage-mind/reports/dogfood-log.md)

Design background (Atlas mind):

→ [`agentic-sage-mind/specs/2026-07-10-dogfood-hardening-design.md`](../../agentic-sage-mind/specs/2026-07-10-dogfood-hardening-design.md)

## Shape (summary)

1. Global `sage on` on the workstation.
2. Project `sage enable` only where you want denser project-scoped signals.
3. `sage war` as the morning / mid-day fleet glance.
4. `sage doctor` after any hook or Node upgrade.
5. End every change that touches a consumer path or abstraction surface with a
   **dogfood verdict** (below) — silence is not a verdict.

Treat the log as lived experience, not a second product contract.

---

## Dogfood verdict vocabulary

A change that touches a **consumer path** (something a human or agent actually
runs — CLI verb, hook inject, board/territory/merge-brief, register/claim) or an
**abstraction surface** (session identity, storage resolution, adapter contract)
ends with **exactly one** of the four tokens below. Silence is not one of the
four.

| Verdict | Meaning | When to use |
|---------|---------|-------------|
| **PASS** | The real path ran end-to-end and behaved correctly | You executed the consumer path and have evidence (command + observed output, or a receipt that names what ran) |
| **FAIL** | The real path ran and the product broke | You exercised the path; it returned wrong data, crashed, or violated its contract. **Not** “I could not run it.” |
| **UNVERIFIED** | The path could not be exercised | Blocked by environment, missing credentials, foreign stack, timeout, etc. **State the blocker** and what would unblock it. Prefer a [reason token](#unverified-reason-tokens). |
| **n/a** | No consumer path applies | Pure docs typo, comment-only, or a change with no agent/human runtime surface |

### Rules that keep the words honest

1. **PASS needs evidence.** Quote the command and the relevant output (or a
   structured receipt). “Looks fine” is not PASS.
2. **FAIL means it ran and broke.** If you never got to run the path, that is
   **UNVERIFIED**, not FAIL.
3. **UNVERIFIED is a successful report** when the blocker is real. It is not a
   soft PASS. Say what would make a later session able to verify.
4. **Do not invent a green light.** Fabricated PASS is worse than a loud
   UNVERIFIED.
5. **n/a is narrow.** If an agent will run the code, it is not n/a.

### Example shapes (agentic-sage)

```text
DOGFOOD: PASS — sage register + claim + board --wide showed distinct sids;
  territory clear for self-only claim (output captured in session notes)
```

```text
DOGFOOD: FAIL — sage claim with open session exited 1:
  "sage: cannot resolve self" despite SAGE_SELF_SID set (repro steps …)
```

```text
DOGFOOD: UNVERIFIED reason=smoke_only — only ran sage doctor --help;
  full multi-session collision path not exercised
```

```text
DOGFOOD: n/a — docs frontmatter typo only; no runtime surface
```

For this repo’s CLI surfaces, a minimal consumer-path PASS often looks like the
happy path in [Getting started](../getting-started.md): register → claim →
board → territory / merge-brief, with real output.

---

## UNVERIFIED reason tokens

When the verdict is **UNVERIFIED**, attach **one** reason from this closed set
(unknown free text is not a substitute — pick the closest token and explain in
prose next to it).

| Token | Reach for it when |
|-------|-------------------|
| `stack_down` | Required local stack or service is not running (dev server, dogfood compose, etc.). You must not start a human-owned long-lived stack just to green a box — report and continue what you can. |
| `no_mcp` | Verification needs an MCP tool/server that is not connected in this session. |
| `missing_token` | An auth token / session credential required by the path is absent (OAuth token, API session). |
| `missing_key` | An API key or secret required by the path is absent from the environment. |
| `headless_no_player` | Path needs a browser, player, or interactive UI the environment cannot drive. |
| `foreign_stack` | Something else is bound to the ports / resources you would use; treating it as “ours” would be false evidence. |
| `sidecar_required_down` | A **required** sidecar (TTS, embedder, queue worker, …) is down; optional sidecars alone are not this token. |
| `human_refused_up` | The human declined to start the stack, grant access, or approve a risky step. |
| `smoke_only` | You only ran help, doctor, or a shallow smoke; the real consumer path was not exercised. |
| `timeout` | The path was started but did not finish within a reasonable bound; you stopped rather than invent a result. |

### Choosing between close tokens

- **stack_down** vs **sidecar_required_down** — whole app/stack missing vs one
  required dependency beside an otherwise up stack.
- **missing_token** vs **missing_key** — user/session credential vs static API
  key/secret.
- **smoke_only** vs **timeout** — you never left the shallow check vs you
  attempted the real path and it hung.
- **foreign_stack** — do not claim PASS against someone else’s process on the
  same port.

### What this vocabulary is not

- Not a substitute for `sage doctor` install health (doctor can be green while
  dogfood is UNVERIFIED because you never registered two sessions).
- Not an npm lifecycle or hosted CI badge. Verification is **local**: you run
  the path (or honestly report that you could not).
- Not a fifth silent state. If you changed a consumer path and wrote no
  verdict, the report is incomplete.

---

## Related

- [Troubleshooting](../reference/troubleshooting.md) — including full `sage doctor` catalogue
- [CLI reference](../reference/cli.md)
- [Live judge](./live-judge.md)
- [Desk fleet](./desk-fleet.md)
