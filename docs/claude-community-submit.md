---
title: "Claude community marketplace submit"
description: "Checklist for submitting agentic-sage to anthropics/claude-plugins-community via the official form."
section: recipes
order: 91
---

# Claude community marketplace submit

**Do not open a PR** against [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community) — they are closed automatically. Use the form.

## Form

https://clau.de/plugin-directory-submission

## Suggested fields

| Field | Value |
|-------|--------|
| **Repository** | `https://github.com/muslewski/agentic-sage` |
| **Plugin name** | `agentic-sage` |
| **Homepage** | `https://sage.muslewski.com/` |
| **Short description** | Passive fleet judge for parallel AI coding sessions — board, territory, merge-brief, optional live judge. Skills + hooks; requires `npm i -g agentic-sage` and `sage on`. |
| **Category** | productivity / developer tools |

## Pre-flight

- [x] `.claude-plugin/plugin.json` present  
- [x] Skills: `sage-fleet`, `sage-judge`, `sage-doctor`  
- [x] README install section  
- [ ] Form submitted (human)  
- [ ] Appears on community mirror after pipeline  

## After approval

```bash
claude plugin marketplace add anthropics/claude-plugins-community
claude plugin install agentic-sage@claude-community
npm i -g agentic-sage && sage on
```
