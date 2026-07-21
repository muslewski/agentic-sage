# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| latest 1.x on npm / main | Yes |
| older | No — please upgrade first |

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

You will receive a response within **72 hours**. We aim to ship a patch within
**14 days** of a confirmed vulnerability.

## Scope

agentic-sage is a local CLI that reads git history and writes to agent config dirs. Primary risk: path traversal via untrusted adapter input, symlink races during install/uninstall, injected shell via hook configuration.

Out of scope: issues in Node.js / Python / the OS, third-party CLIs this tool
launches, or GitHub Actions runners themselves.
