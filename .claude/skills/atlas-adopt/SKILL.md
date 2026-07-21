---
name: atlas-adopt
description: >
  Use when the user wants to adopt this knowledge base, onboard a brownfield
  vault, act on "atlas adopt reported unclassified notes", or migrate existing
  docs/mind into atlas. Deterministic adopt first; this skill classifies
  leftover notes and proposes zone cards without stamping.
---

# Atlas adopt — brownfield classification layer

The toolkit owns deterministic transforms (`atlas adopt`: wikilink zones → bare
slugs, zone honesty, debt type, `human-drafts/` → drafts, seed config). You own
the judgment layer: classify unclassified notes, place them in the right
folder, and propose zone cards — never pre-stamp.

## Procedure

1. **Ground truth first.** Run the dry command and act only on its output —
   never on memory of the vault:
   - `npx --no-install atlas adopt` (no `--write`)

2. **Apply deterministic transforms when pending.** Echo the adopt plan to the
   user, then run:
   - `npx --no-install atlas adopt --write`

3. **Classify each `unclassified` note.** For every `? <path>` line in the
   report (or still present after `--write`):
   - Read the note.
   - Classify into **Map** (zone / flow), **Ledger** (decision / spec / plan /
     debt / idea / report), **Vision**, or **out-of-scope**.
   - Move it into the configured folder and set `type:` frontmatter to match.
   - When unsure, list it for the owner instead of guessing.

4. **Zone extraction.** When an architecture doc describes a coherent
   subsystem:
   - Propose a zone card from `templates/notes/zone.md` (or the vault's copy).
   - Draft `owns.globs` from paths the doc names — owner verifies before stamp.
   - Card starts `status: seeded`, `verifiedAt: unverified`.
   - **NEVER stamp during adoption.**

5. **Finish wiring and migrations.**
   - `npx --no-install atlas wire all`
   - `npx --no-install atlas migrate --write`
   - `npx --no-install atlas build`
   - `npx --no-install atlas check`
   - Echo remaining warnings to the user.

6. **Report.** One summary: moved / classified / proposed-zones /
   left-for-owner.

## HARD RULES

- Never delete user notes.
- Never pre-stamp (`verifiedAt` stays `unverified` until a human reviews and
  runs `atlas stamp <slug>`).
- Never edit note bodies during classification — frontmatter + location only.
- Stop and ask on any ambiguity.
- Dry-run before every write path (`atlas adopt` without `--write` first).
