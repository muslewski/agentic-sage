# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| latest 0.x minor (currently 0.2.x) | Yes |
| older | No — upgrade first |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately via
[GitHub's private security advisory](https://github.com/muslewski/agentic-sage/security/advisories/new)
or email **10kento10@gmail.com** with the subject line `[SECURITY] agentic-sage`.

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive a response within 72 hours. We aim to release a patch within 14 days of
a confirmed vulnerability.

## Scope

agentic-sage is a local CLI that reads git history and writes to `~/.claude`. It has no
network server and no external API calls. The primary risk surface is:

- Path traversal via untrusted adapter input
- Symlink race conditions during install/uninstall
- Injected shell commands via hook configuration

Out of scope: issues in Node.js itself, GitHub Actions runners, or the user's OS.
