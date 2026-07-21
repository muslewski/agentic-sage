---
name: writing-for-retrieval
description: Use when authoring or editing an Atlas note (zone, decision, spec, plan, idea, debt, pillar) — the summary and section structure determine what a retrieval engine surfaces later.
---

# Writing Atlas notes for retrieval

A retrieval engine (`ctx_search` or otherwise) usually shows the `summary`
field plus one matched section snippet, not the whole note. Write for that
surface, not for a cover-to-cover reader.

## Do this

| Element | Rule |
|---|---|
| `summary` | 1–3 sentences, ≤ 500 chars, carries the note's distinctive terms — this is the line retrieval shows before anyone opens the file. |
| `##` sections | One concept per heading. A search hit returns the matched section; a section mixing two ideas returns the wrong one for the other query. |
| Vocabulary | Distinctive, noun-heavy terms over generic verbs ("pending webhook retry queue", not "handles processing"). Generic verbs match everything and rank nothing. |
| `[[wikilinks]]` | Only link notes that exist; a dangling link is a graph-coherence gap the generated index flags. |
| `owns.globs` (zone cards) | Keep current — a stale glob list makes the anchor check fail, or silently claims code the zone no longer owns. |
| `status` | Match reality: `seeded` until a human/reviewed pass verifies the card; don't self-promote to `active`. |

## Common mistakes

- A summary that repeats the title instead of adding distinctive terms —
  retrieval has nothing new to rank on.
- A wall-of-prose `##` section covering three concepts — the snippet
  returned for any one query is diluted or wrong.
- Writing `owns.globs` once at creation and never revisiting it as the
  zone's code moves — the anchor check exists specifically to catch this.

Write the note as if the only thing a future agent will ever see is the
`summary` plus one matched section — because that's usually true.
