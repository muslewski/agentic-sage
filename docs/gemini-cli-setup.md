---
title: "Gemini CLI setup"
description: "Install agentic-sage skills for Google Gemini CLI and optional Antigravity paths."
section: recipes
order: 92
---

# Gemini CLI setup

Agent Skills for Gemini use the [Agent Skills open standard](https://agentskills.io/specification) (`SKILL.md`). Prefer **Gemini CLI ≥ 0.26**.

## Install skills

```bash
# All three skills from this monorepo
gemini skills install https://github.com/muslewski/agentic-sage.git --path skills --consent

# One skill
gemini skills install https://github.com/muslewski/agentic-sage.git --path skills/sage-fleet --consent

# Workspace-only (project .gemini/skills — needs trusted workspace)
gemini skills install https://github.com/muslewski/agentic-sage.git --path skills --scope workspace --consent
```

Cross-agent (skills.sh) — prefer sage product skills only (avoid `--all`; it also pulls Atlas helpers under `.claude/skills/`):

```bash
npx skills add muslewski/agentic-sage \
  --skill sage-fleet --skill sage-judge --skill sage-doctor \
  -a gemini-cli -g -y
```

## CLI (required for board / territory / judge)

```bash
npm install -g agentic-sage
sage init    # optional
sage on
```

## Verify

```bash
gemini
# /skills list
# /skills reload
# Ask: "before I open a PR, check fleet collisions" → sage-fleet
```

## Discovery paths Gemini uses

| Scope | Paths |
|-------|--------|
| User | `~/.gemini/skills/`, `~/.agents/skills/` |
| Workspace | `.gemini/skills/`, `.agents/skills/` |

## Optional project pointer

Paste [templates/GEMINI.snippet.md](../templates/GEMINI.snippet.md) into project `GEMINI.md` / rules if you want an always-on one-liner.

## Notes

- There is **no** separate Gemini skill-store form — public GitHub + install commands.
- Optional future: `gemini-extension.json` + GitHub topic `gemini-cli-extension` for the extension gallery.
- Hooks for Claude/Grok are **not** Gemini session hooks; Gemini users get **skills + CLI**.
