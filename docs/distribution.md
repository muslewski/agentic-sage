---
title: "Distribution — plugins & skills"
description: "Where agentic-sage is published: npm, Grok, Claude, Cursor, Codex, Gemini, skills.sh, and directory listings."
section: recipes
order: 90
---

# Distribution — plugins & skills

SAGE has two install layers:

| Layer | What you get | Required for |
|-------|----------------|--------------|
| **npm CLI** | `sage` binary, store, judge | `board`, `territory`, `merge-brief`, `judge`, `about` |
| **Harness plugin / skills** | Agent learns *when* to call sage | Discoverability in each UI |

## npm (always)

```bash
npm install -g agentic-sage
sage init
sage on
```

## Grok Build

```bash
grok plugin install muslewski/agentic-sage --trust
# Official catalog after merge: /marketplace → agentic-sage
```

- Manifest: `.grok-plugin/plugin.json` · hooks: `hooks/hooks.json`  
- PR: https://github.com/xai-org/plugin-marketplace/pull/140  

## Claude Code

```text
/plugin marketplace add muslewski/agentic-sage
/plugin install agentic-sage@agentic-sage
```

Community form (not a PR): Console  
https://platform.claude.com/plugins/submit  
→ after approval: `@claude-community`  
Checklist: [Claude community submit](./claude-community-submit.md)

## Cursor

```text
Publisher form: https://cursor.com/marketplace/publish
Repo: https://github.com/muslewski/agentic-sage
```

Manifest: `.cursor-plugin/plugin.json` · logo: `assets/logo.svg`

## Codex (ChatGPT Work / Codex CLI)

**Git install (works without OpenAI review):**

```bash
codex plugin marketplace add muslewski/agentic-sage
# then: /plugins → enable agentic-sage
npm i -g agentic-sage && sage on
```

**Official Plugins Directory (form):**

1. Package ready: `.codex-plugin/plugin.json` + `skills/` + `PRIVACY.md`  
2. OpenAI org with **Apps Management → Write** + verified identity  
3. **https://platform.openai.com/plugins** → Create → **Skills only** → ZIP + 5 pos / 3 neg tests → Submit  

Docs: https://learn.chatgpt.com/docs/submit-plugins  

**Community (optional, same day):**

- https://www.codex-marketplace.com/submit  
- PR [awesome-codex-plugins](https://github.com/hashgraph-online/awesome-codex-plugins) (scanner score ≥ 80)

Manifest: `.codex-plugin/plugin.json` · marketplace: `.agents/plugins/marketplace.json`

## Gemini CLI

```bash
gemini skills install https://github.com/muslewski/agentic-sage.git --path skills --consent
# verify: /skills list
npm i -g agentic-sage && sage on
```

Guide: [gemini-cli-setup.md](./gemini-cli-setup.md) · snippet: `templates/GEMINI.snippet.md`  
No Gemini skill-store form — GitHub + install is enough.

## skills.sh (all agents)

**Live index (no form — auto from GitHub):**  
https://www.skills.sh/muslewski/agentic-sage  
→ `sage-fleet` · `sage-judge` · `sage-doctor`

**Recommended (sage only, multi-agent, global):**

```bash
npx skills add muslewski/agentic-sage \
  --skill sage-fleet --skill sage-judge --skill sage-doctor \
  -a claude-code -a cursor -a codex -a gemini-cli -g -y
```

Then still run the CLI layer:

```bash
npm install -g agentic-sage && sage on
```

| Flag | Effect |
|------|--------|
| `--skill sage-*` | Install only fleet/judge/doctor |
| `-g` | User-global `~/.agents/skills/` |
| `-a …` | Wire named agents (Claude Code gets symlinks) |
| `--all` | **Avoid** — also pulls vendored Atlas skills under `.claude/skills/` (not product surface) |

List without installing: `npx skills add muslewski/agentic-sage -l`

## Directory listings (discovery, not harness install)

| Site | Submit | Notes |
|------|--------|-------|
| [agentskill.sh/submit](https://agentskill.sh/submit) | GitHub import | Multi-agent skill marketplace |
| [skillsdirectory.com/submit](https://www.skillsdirectory.com/submit) | Form + security scan | Skills |
| [agenticskills.io/submit](https://agenticskills.io/submit) | Form ~48h review | Skills + multi-platform |
| [pluginmarketplace.ai/submit](https://pluginmarketplace.ai/submit) | Form | Claude-oriented |
| [codex-marketplace.com/submit](https://www.codex-marketplace.com/submit) | GitHub | After `.codex-plugin` |
| [buildwithclaude.com](https://buildwithclaude.com/) | PR to davepoon/buildwithclaude | Claude discovery |
| [hol.org/registry/plugins](https://hol.org/registry/plugins) | Scanner + awesome PR | Codex trust |
| MCP registries (Smithery, mcp.so, Glama, Pulse) | **Skip** | SAGE is not an MCP server |

## Pin discipline

After releases that marketplaces pin by SHA (Grok Official, Claude community):

1. Push `main`  
2. `git rev-parse HEAD`  
3. Bump catalog pin / re-publish  

## Mental model

```text
CLI (npm) ──► truth: store, board, judge
Plugins   ──► skills + hooks in one harness UI
skills.sh ──► SKILL.md on 70+ agents
Directories ──► SEO / browse (forms or auto-index)
```
