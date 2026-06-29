---
name: sage-doctor
description: |
  Validate the SAGE fleet-judge install — config, emitter hook, settings wiring,
  linked skills, current repo. Trigger: /sage-doctor
user-invocable: true
---

# SAGE Doctor

Check that SAGE is wired correctly and report it in the conversation.

## Instructions

1. Run `sage doctor` (it resolves the current repo from the cwd) and capture stdout.
2. Display the output **verbatim** — it is already formatted (`✓` pass / `✗` needs attention) and
   ends with an `N ok · M need attention` verdict line. SAGE being OFF or absent is **healthy**
   (default-OFF) — report it, never treat it as an error.
3. **Fallback** (only if `sage` is not on PATH / the call errors): derive the SAGE repo root from
   this skill's base directory (go up 2 levels — strip `/skills/sage-doctor`), then run:
   ```
   node "<SAGE_ROOT>/bin/sage" doctor
   ```
   Re-display verbatim with the same `✓`/`✗` prefixes.
