# Contributing to agentic-sage

Thank you for your interest!


## Community

| Kind | Where |
|---|---|
| Questions, ideas, show-and-tell | [Discussions](https://github.com/muslewski/agentic-sage/discussions) |
| Bugs & concrete feature requests | [Issues](https://github.com/muslewski/agentic-sage/issues/new/choose) |
| Security | [SECURITY.md](./SECURITY.md) — private only |

Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Dev setup

```bash
git clone https://github.com/muslewski/agentic-sage.git
cd agentic-sage
npm install          # installs biome (dev dep); no runtime deps
node install.mjs     # wire into your own ~/.claude to dogfood while developing
```

## Running tests

```bash
node --test          # all tests (node:test, no external runner)
node --test test/wiring.test.mjs   # single file
```

Tests are hermetic — they create temp HOME directories and never touch your real `~/.claude`.

## Adapters

See [ADAPTERS.md](./ADAPTERS.md) for how to write a per-project adapter and test it.

## Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) because
release-please uses them to compute version bumps and write CHANGELOG.md automatically.

| Prefix | Effect |
|---|---|
| `feat:` | minor version bump; appears in CHANGELOG |
| `fix:` | patch bump; appears in CHANGELOG |
| `perf:` | patch bump; appears in CHANGELOG |
| `docs:`, `chore:`, `ci:`, `refactor:` | patch / no bump; hidden in CHANGELOG |

Breaking changes: add `!` after the type (`feat!:`) or a `BREAKING CHANGE:` footer.

## Pull requests

1. Fork and create a branch: `git checkout -b fix/what-you-fix`.
2. Write a test if your change is logic-touching.
3. Run `node --test` and `npx biome check .` — both must pass.
4. Open a PR against `main` with a descriptive title and the PR template filled in.

## Reporting issues

Use the GitHub issue templates (bug report or feature request). For security issues, see
[SECURITY.md](./SECURITY.md).
