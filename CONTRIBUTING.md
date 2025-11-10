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

- Public API is exported via `components/index.ts`.
- If you add new props or behavior, update the README Component API and add example cases in the blog content.

## Publishing

- This repo is currently marked `"private": true` in `package.json`. To publish:
  1. Remove `private` or set it to `false`.
  2. Ensure `exports` points to built files (e.g., `dist/index.js`) and type defs.
  3. Consider adding a build step (tsup/tsup-node/tsc) to output ESM and types.
  4. `npm publish --access public`.

## Code of Conduct

- Be respectful and constructive.
- Assume good intent; propose solutions; listen actively.

## Author & Maintainer

- Hesbon Osoro <hesbonosoro1@gmail.com> — available for contribution and crafting software solutions.
