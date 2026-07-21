# agentic-sage · Atlas mind

Code-verified knowledge vault for **agentic-sage** — architecture map (zones),
decision ledger, specs/plans, and tech-debt. Agents orient here before
touching code.

| Start | Path |
|-------|------|
| Map index | [`map/index.md`](./map/index.md) |
| Zones | `map/zones/` |
| Decisions | `map/decisions/` |
| Specs / plans | `specs/` · `plans/` |
| Tech debt | `tech-debt/` |

## Agent loop

1. **Orient** — `map/index.md` → relevant zone card → code.
2. **Work** — change code with zone claims in mind.
3. **Recollect** — update touched zones, `atlas stamp <slug>`, `atlas build` / `atlas check`.

CLI (from repo root):

```bash
npx memory-atlas status
npx memory-atlas build
npx memory-atlas check
npx memory-atlas stamp <zone-slug>
```

## Not an npm dependency

This vault is **markdown in git** for agents and humans. It is **not** shipped
when someone runs `npm install` on this project (keep it out of package
`files` if you publish a library). The CLI is the separate package
[`memory-atlas`](https://www.npmjs.com/package/memory-atlas) — that install
only brings tools/templates/skills, never this mind or other repos' minds.

## Powered by [memory-atlas](https://github.com/muslewski/memory-atlas)

This vault follows the **memory-atlas** convention: plain markdown + YAML
frontmatter, git-backed `verifiedAt` freshness, zero runtime deps, Obsidian-
compatible. Site: [atlas.muslewski.com](https://atlas.muslewski.com).

```bash
npm i -D memory-atlas
npx atlas init
```

Do not hand-edit generated `map/index.md`. Zone bodies and ledger notes are
the source of truth for claims.
