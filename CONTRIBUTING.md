# Contributing to audio-reader-highlight

Thanks for your interest in contributing! Please follow the guide below to propose changes, open issues, or publish improvements.

## How to Propose Changes

- Fork the repo and create a descriptive branch from `main`.
  - Example: `feat/units-signal-siemens`, `fix/overlay-jitter`, `docs/readme-improvements`.
- Make focused commits with clear messages.
- Add or update tests/examples in `app/page.tsx` for user-visible behavior.
- Run locally:
  - `yarn` or `npm install`
  - `yarn dev` or `npm run dev`
  - `yarn lint` and `yarn format` before pushing
- Open a Pull Request against `main` with:
  - What/Why summary
  - Screenshots or short clips for UI/UX changes
  - Edge cases covered (esp. currencies/units/abbreviations)

## Issues

- Use GitHub Issues for bugs/feature requests.
- Include reproduction steps, expected vs actual behavior, and environment (browser/OS).

## Code Style

- Prettier and ESLint are configured. Run `yarn format` and `yarn lint`.
- Keep components and helpers small and focused.
- Do not add or delete comments/documentation in source unless the change is explicitly requested.

## Component API Docs

- The public API is what `packages/audio-reader-highlight/src/index.ts` (core) and `src/react/index.ts` (React) export.
- If you add new options or behaviour, update the package README.

## Publishing

Releases are published by GitHub Actions with npm trusted publishing. See "Releasing the npm
package" in the [README](README.md#releasing-the-npm-package).

## Code of Conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). Be respectful and
constructive, assume good intent, and propose solutions.

## Security

Please report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md). Don't use public
issues for them.

## Author & Maintainer

- Hesbon Osoro <osoro@hesbon.dev> (https://hesbon.dev) — available for contribution and crafting software solutions.
