# Reports

Point-in-time snapshots — what something *was* at one moment, derived from
code, git history, or backlog state. A report commits to nothing and
supersedes nothing; once written it is frozen. Forward-looking truth lives
in plans, specs, and decisions.

Naming: `YYYY-MM-DD-<topic>.md`

Frontmatter contract:
```yaml
type: report
status: snapshot
summary: "One-paragraph abstract of the snapshot."
zones: [zone-ids, touched]
covers: path/or/artifact/the/report/describes
created: YYYY-MM-DD
updated: YYYY-MM-DD
```
