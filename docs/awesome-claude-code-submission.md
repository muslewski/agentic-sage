# awesome-claude-code Submission

Submit a GitHub issue at:
`https://github.com/hesreallyhim/awesome-claude-code/issues/new/choose`

Select template: **"🚀 Recommend New Resource"**

---

## Form payload

**Display Name:**
```
agentic-sage
```

**Category:** (pick from dropdown)
```
Agent Skills
```

**Sub-Category:** (optional, leave blank or pick if available)
```
Fleet / Multi-Agent
```

**Primary Link:**
```
https://github.com/muslewski/agentic-sage
```

**Secondary Link:** (optional)
```
https://www.npmjs.com/package/agentic-sage
```

**Author Name:**
```
muslewski
```

**Author Link:**
```
https://github.com/muslewski
```

**License:**
```
MIT
```

**Description:**
```
Passive read-only fleet judge for parallel Claude Code sessions. Installs as a global
CLI (`sage`) plus two Claude Code skills (`sage-fleet`, `sage-doctor`). Sessions call
`sage territory` / `sage claim` / `sage merge-brief` to coordinate without colliding;
the human reads `sage board` for fleet altitude. Default OFF, zero runtime deps.
```

**Validate Claims** (required for skills/plugins):
```
Install: npm install -g agentic-sage && sage init && sage on
In a git repo with two terminal sessions both running Claude Code, run `sage board`
in either — it lists both live sessions, their branch, and their claimed globs.
Run `sage territory 'src/**'` in one session to confirm overlap detection works.
```

---

## Notes

- The bot validates: URL accessibility, no duplicates, all required fields present.
- Maintainer runs `/approve` or `/request-changes` after review.
- On approve, the bot adds the entry to `THE_RESOURCES_TABLE.csv` and regenerates the
  README via an auto-PR.
- This is a manual step — do not automate submission.
