---
name: atlas-update
description: >
  Use when the user wants to update atlas, an atlas update is available, doctor
  or status reports a version nudge / pending migrations, or they ask to bring
  the vault to latest. Deterministic migrate first; this skill handles AI-merge
  of locally edited vendored files.
---

# Atlas update — bring an adopting repo to the installed toolkit version

The toolkit owns deterministic transforms (`atlas migrate`). You own the
judgment layer: merging locally edited on-ramp blocks and vendored skills
without destroying user customizations.

## Procedure

1. **Ground truth first.** Run both dry commands and act only on their output
   — never on memory of what atlas does:
   - `npx --no-install atlas doctor`
   - `npx --no-install atlas migrate` (dry-run; no `--write`)

2. **Apply deterministic migrations.** Echo the migrate plan to the user,
   then run:
   - `npx --no-install atlas migrate --write`

3. **Reconcile every `⚠ locally edited` vendored item.** For each one doctor
   lists:
   - Read the **local** file on disk.
   - Read the **upstream** version from the installed package
     (`node_modules/memory-atlas/skills/…` for skills, or the block text
     `atlas wire` would render for on-ramp markers).
   - Merge by judgment: preserve every local customization; adopt upstream
     structure and additions. When local and upstream conflict on the same
     line, **keep local** and note it in the summary. Never resolve by
     deleting user content.

4. **Re-wire.** `npx --no-install atlas wire all` — pristine blocks/hooks
   re-render; your merged files keep their new hashes recorded in
   `.atlas-state.json`.

5. **Verify.**
   - `npx --no-install atlas check`
   - `npx --no-install atlas doctor`
   - Doctor must end all-✓ except deliberate `locally edited` items you just
     reconciled (and any pre-existing intentional local edits you left).

6. **Report.** One diff summary: files touched, migrations applied, conflicts
   kept-local.

## HARD RULES

- Never modify zone cards, decisions, specs, plans, reports, or
  `atlas.config.json` values the user set.
- Migrations and wire may only touch machine-owned artifacts (state file,
  content inside atlas markers, vendored skill copies, hook wiring).
- Stop and ask on any ambiguity.
- Dry-run before every write path (`atlas migrate` without `--write` first;
  never invent filesystem writes the CLI does not perform).
