#!/usr/bin/env bash
# Packs packages/audio-reader-highlight and checks the tarball the way a consumer would use it:
# ESM import, CommonJS require, the /react entry, and TypeScript types under nodenext and bundler.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
(cd "$root/packages/audio-reader-highlight" && npm pack --silent --pack-destination "$work" >/dev/null)
cd "$work"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund ./audio-reader-highlight-*.tgz react@19 @types/react@19 typescript@5.9 >/dev/null
node -e "const m=require('audio-reader-highlight'); if(!m.ReadAloud||!m.buildSpeechFromSegment) process.exit(1)"
node --input-type=module -e "import {ReadAloud} from 'audio-reader-highlight'; import {Readable,PlayerDock,ListenButton,useReader} from 'audio-reader-highlight/react'; if(!ReadAloud||!Readable||!PlayerDock||!ListenButton||!useReader) process.exit(1)"
printf "import * as m from 'audio-reader-highlight';\nimport * as r from 'audio-reader-highlight/react';\nexport const all = [m, r];\n" > t.ts
./node_modules/.bin/tsc --noEmit --strict --target es2022 --jsx react-jsx --module nodenext --moduleResolution nodenext t.ts
./node_modules/.bin/tsc --noEmit --strict --target es2022 --jsx react-jsx --module esnext --moduleResolution bundler t.ts
test -f node_modules/audio-reader-highlight/dist/styles.css
test -f node_modules/audio-reader-highlight/CHANGELOG.md
echo "smoke-pack: ok"
