# Privacy Policy — agentic-sage

**Last updated:** 2026-07-24

Agentic SAGE is open-source software you run **on your own machines**. There is no agentic-sage cloud backend that receives your code or chat by default.

## What the software does

- The `sage` CLI and optional hooks write **local** session metadata under your home directory (by default under `~/.claude/agentic-sage/`), such as session ids, branches, paths, and advisory briefs you generate.
- Data stays on hosts you control unless **you** sync that directory, commit it, or point config at a shared path.
- The plugin/skills instruct AI coding agents how to call `sage`; they do not send content to Muslewski or Anthropic beyond whatever the host agent (Claude Code, Cowork, etc.) already does under its own terms.

## What we do not collect

- No telemetry service is required to use the plugin.
- The project authors do not operate a central service that scrapes your repos via this plugin.

## Third parties

- **Anthropic** (Claude Code / Cowork marketplace, review pipeline) processes submissions and usage under Anthropic’s policies.
- **npm / GitHub** host distribution artifacts under their terms.
- If you enable optional integrations (e.g. remote hosts via mossferry, your own git remotes), those systems have their own policies.

## Contact

- Issues: https://github.com/muslewski/agentic-sage/issues  
- Email: 10kento10@gmail.com  

## Changes

Updates to this policy will be committed to this file in the public repository.
