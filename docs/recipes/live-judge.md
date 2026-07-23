---
title: "Live judge session"
description: "Optional Claude/Grok pane that publishes continuous fleet/repo briefs for workers."
section: recipes
order: 40
---

# Live judge session

SAGE’s universal core is a **passive sensor** (board, territory, merge-brief).  
You can also open a **live judge** pane — a normal agent session that watches the fleet, reasons, and publishes short advisory briefs. Workers still get deterministic CLI facts first; briefs layer on when fresh.

## When to use it

- Several parallel agents on one desk and you want a standing narrative (“who’s hot, what collides”).
- Dogfooding multi-session coordination without a human staring at `sage war` full-time.

## Quick start (recommended)

```bash
# One command — auto scope (fleet if multi-repo desk, else this repo),
# auto harness (grok → claude → fact-only keeper):
sage judge run

# Force scope / harness:
sage judge run --fleet --harness grok
sage judge run --repo --harness none --once   # fact brief, no LLM
sage judge run --print-only                   # paste kit only
```

Config (optional) in `~/.claude/agentic-sage/config.json`:

```json
{
  "enabled": true,
  "judge": {
    "harness": "auto",
    "scope": "auto",
    "commands": { "grok": "grok", "claude": "claude" }
  }
}
```

### Manual pane (skill loop)

```bash
sage judge on --fleet          # desk altitude
# or: sage judge on --repo     # this repo only

# Load skill sage-judge, then loop:
sage war --json
sage judge publish <<'EOF'
{
  "summary": "one-line desk state",
  "analysis": "short advisory prose — no winners",
  "confidence": "medium",
  "advice": [
    { "audience": "workers", "text": "Narrow claims on src/foo if dual-live" },
    { "audience": "human", "text": "Two live sessions on lib/ — reallocate" }
  ]
}
EOF

sage judge off
```

### War dashboard

When a judge is live (or a brief is in grace), `sage war` shows a **⚖** chip in the
header and a judge line on the FLEET panel.

Workers:

```bash
sage territory 'src/**'
sage merge-brief
# facts first, then optional:
# ── live judge · repo · …
# ── live judge · fleet · …
```

Use `--no-brief` for facts only.

## Freshness

| State | Worker sees brief? |
|-------|--------------------|
| Judge live + publish within TTL (120s) | Yes |
| Judge process just died / burst publish | Yes for **~30s grace** (chip: `· grace`) |
| After grace / TTL / `judge off` (stale) | No — pure CLI |

Grace does **not** hold the judge slot: a new `sage judge on` can start without `--takeover` once the previous process is dead.

## Rules (same as sage-fleet doctrine)

- Do not claim product globs while judging.
- Do not arm the guard unless the human asked.
- Do not pick winners between live workers — advise / surface to human.
- Core never calls a model; you do the reasoning in the pane.

## Related

- Skill: `skills/sage-judge/SKILL.md`
- Schema: [`SCHEMA.md`](../../SCHEMA.md) (`sage.brief`, `briefs` on fleet/war JSON)
- Concept: [Fleet judge](../concepts/fleet-judge.md)
