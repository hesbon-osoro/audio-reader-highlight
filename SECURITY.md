# Security policy

## Supported versions

| Package version | Supported                |
| --------------- | ------------------------ |
| 2.x             | ✅ Security fixes        |
| 1.x             | ❌ Please upgrade to 2.x |

`audio-reader-highlight` 2.x has no runtime dependencies. React is an optional peer dependency.

## Reporting a vulnerability

Please **don't open a public issue** for a security problem.

- Report it privately through GitHub: **Security → Report a vulnerability** on this repository
  ([direct link](https://github.com/hesbon-osoro/audio-reader-highlight/security/advisories/new)).
- Or email osoro@hesbon.dev with "SECURITY" in the subject.

You'll get an acknowledgement within 3 working days. Once the issue is confirmed, the fix ships in a
patch release and the advisory is published with credit to you, unless you'd rather stay anonymous.

## Scope

- **In scope:** the published npm package (`packages/audio-reader-highlight`). For example: script
  injection through text processing, or unsafe DOM handling in the highlighter or the React bindings.
- **Out of scope:**
  - the demo site's own deployment configuration;
  - issues that need a compromised browser or extension;
  - speech-engine behaviour that belongs to the browser.
