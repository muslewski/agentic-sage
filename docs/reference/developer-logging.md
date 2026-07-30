---
title: "Developer logging"
description: "Opt-in local-only fleet-devlog — enums and counts only, never published."
section: reference
order: 50
---

# Developer logging

Opt-in **local-only** developer event log shared with sibling fleet tools (`memory-atlas`, `llm-armory`, `mossferry`). **Off by default.** Nothing is written unless you explicitly enable it.

## Enable (first match wins)

1. `FLEET_DEVLOG=0|false|off|no` → off
2. `--no-devlog` on the command line → off
3. `FLEET_DEVLOG=1|true|on|yes` → on
4. Machine config `~/.config/fleet-devlog/config.json` with `{"enabled": true}` → on
5. Otherwise → **off**

## Where it lives

```text
~/.local/state/fleet-devlog/events.jsonl
~/.local/state/fleet-devlog/install-id
```

(`$XDG_STATE_HOME` overrides the `~/.local/state` prefix when set.)

## What is recorded

Enums (`tool`, `cmd`, `result_class`), ids (`install_id`, `repo_id`, `corr`), hashes, and numbers only (exit code, duration in ms). Flags are allow-listed (`argv_shape`); flag **values** are never kept.

## What is never recorded

Prompts, session transcripts, commit messages, file contents, absolute or relative paths, environment values, API keys, or free-form text.

## It never leaves the machine

The vendored emitter (`lib/fleet-devlog.mjs`) contains no network code — no `http`, `fetch`, or transport. There is no uploader and no “share stats” path.

## Delete it

```bash
rm -rf ~/.local/state/fleet-devlog
```
