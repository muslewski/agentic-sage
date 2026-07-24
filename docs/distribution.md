---
title: "Distribution — plugins & skills"
description: "Where agentic-sage is published: npm CLI, Grok/Claude/Cursor plugins, skills.sh, and how to install each."
section: recipes
order: 90
---

# Distribution — plugins & skills

SAGE has two install layers. Do not mix them up:

| Layer | What you get | Required for |
|-------|----------------|--------------|
| **npm CLI** | `sage` binary, store, judge | `board`, `territory`, `merge-brief`, `judge`, `about` |
| **Harness plugin / skills** | Agent learns *when* to call sage | Discoverability in Grok / Claude / Cursor / skills.sh |

Full research (fleet memory): `work-kb` report  
`work-kb-mind/reports/2026-07-24-agent-plugin-skill-marketplaces.md`

## npm (always)

```bash
npm install -g agentic-sage
sage init    # optional wizard / hooks
sage on      # enable globally (default off)
```

## Grok Build

```bash
# Official marketplace (after xAI PR merges):
#   /marketplace → agentic-sage → install

# Direct from GitHub (works now):
grok plugin install muslewski/agentic-sage --trust
```

Manifest: `.grok-plugin/plugin.json` · hooks: `hooks/hooks.json`  
Marketplace PR: https://github.com/xai-org/plugin-marketplace/pull/140

## Claude Code

**Self-hosted marketplace (works now):**

```text
/plugin marketplace add muslewski/agentic-sage
/plugin install agentic-sage@agentic-sage
```

**Community marketplace (submit once):**

1. Open https://clau.de/plugin-directory-submission  
2. Point at `https://github.com/muslewski/agentic-sage`  
3. After approval, users:

```bash
claude plugin marketplace add anthropics/claude-plugins-community
claude plugin install agentic-sage@claude-community
```

Manifest: `.claude-plugin/plugin.json`

## Cursor

```bash
# Local / git install when Cursor supports path install:
# add-plugin → GitHub muslewski/agentic-sage
# Or copy/link skills from ./skills into Cursor’s skill paths
```

Manifest: `.cursor-plugin/plugin.json` · skills: `./skills/`  
Public Cursor Marketplace: submit via Cursor’s Create Plugin / marketplace flow when ready.

## skills.sh (cross-agent SKILL.md)

```bash
# List skills in this repo
npx skills add muslewski/agentic-sage -l

# Install all skills for all detected agents
npx skills add muslewski/agentic-sage --all

# Or pick one (global):
npx skills add muslewski/agentic-sage --skill sage-fleet -g
npx skills add muslewski/agentic-sage --skill sage-judge -g
npx skills add muslewski/agentic-sage --skill sage-doctor -g
```

Directory: https://www.skills.sh/ · Spec: https://agentskills.io/specification

## Codex / Gemini (Tier 2)

- **Codex:** plugin browser `/plugins`; skill paths via skills.sh or Codex skill catalog.  
- **Gemini CLI:** `gemini skills install https://github.com/muslewski/agentic-sage.git` (skills only).

## Pin discipline

When shipping a release that marketplaces pin by SHA (Grok Official, Claude community):

1. Tag / push `main`  
2. `git rev-parse HEAD`  
3. Bump marketplace catalog pin (or re-submit form)  
