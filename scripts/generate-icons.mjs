// Rasterises the brand SVGs in public/ into every PNG/ICO the site ships:
// favicons, apple-touch, PWA (any + maskable) and the Open Graph images.
//
//   node scripts/generate-icons.mjs
//
// Sources: public/favicon.svg (16px grid, for 16/32px) and public/icon.svg
// (detailed mark, for everything larger). Uses sharp, which Next.js already
// installs, so there is no extra dependency.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (...p) => path.join(root, 'public', ...p);

const BG = '#05070a';
const small = await readFile(pub('favicon.svg'), 'utf8');
const icon = await readFile(pub('icon.svg'), 'utf8');

/** The mark's shapes without the svg wrapper, title, comments or background. */
const inner = icon
  .replace(/^[\s\S]*?<rect width="64" height="64"[^>]*\/>/, '')
  .replace(/<\/svg>\s*$/, '');

/** The mark on a custom background, shrunk around its centre by `scale`. */
const framed = (bg, scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg}` +
  `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${inner}</g></svg>`;

const fullBleed = framed(`<rect width="64" height="64" fill="${BG}"/>`);
// Maskable icons are cropped to a circle as small as 80% of the canvas.
const maskable = framed(`<rect width="64" height="64" fill="${BG}"/>`, 0.74);
const circle = framed(`<circle cx="32" cy="32" r="32" fill="${BG}"/>`, 0.82);

const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="${BG}"/>
  <svg x="110" y="165" width="300" height="300" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="#0b1118"/>${inner}
  </svg>
  <g font-family="Inter, 'DejaVu Sans', Arial, sans-serif">
    <text x="470" y="262" fill="#e2e8f0" font-size="70" font-weight="700" letter-spacing="-2">Audio Reader</text>
    <text x="470" y="342" fill="#00d4ff" font-size="70" font-weight="700" letter-spacing="-2">Highlight</text>
    <text x="472" y="404" fill="#94a3b8" font-size="30">Hear every word. See every word.</text>
  </g>
  <text x="472" y="462" fill="#00ff41" font-size="24" font-family="'DejaVu Sans Mono', ui-monospace, monospace">$ npm i audio-reader-highlight</text>
</svg>`;

/** Renders at exactly `size` px (no resampling), so small sizes stay crisp. */
const png = (svg, size) =>
  sharp(
    Buffer.from(
      svg.replace(
        /<svg([^>]*?)(?: width="\d+" height="\d+")?>/,
        `<svg$1 width="${size}" height="${size}">`
      )
    )
  )
    .png({ compressionLevel: 9 })
    .toBuffer();

/** An ICO whose entries are PNGs (supported by every browser since IE Vista). */
const ico = images => {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(i => i.data)]);
};

const f16 = await png(small, 16);
const f32 = await png(small, 32);
const outputs = {
  'favicon-16x16.png': f16,
  'favicon-32x32.png': f32,
  'favicon.ico': ico([
    { size: 16, data: f16 },
    { size: 32, data: f32 },
  ]),
  'apple-touch-icon.png': await png(fullBleed, 180),
  'android-chrome-192x192.png': await png(icon, 192),
  'android-chrome-512x512.png': await png(icon, 512),
  'android-chrome-maskable-512x512.png': await png(maskable, 512),
  'images/audio-reader-highlight-circle.png': await png(circle, 393),
};

const ogPng = await sharp(Buffer.from(og))
  .png({ compressionLevel: 9 })
  .toBuffer();
outputs['images/audio-reader-highlight_cropped.png'] = ogPng;
outputs['images/audio-reader-highlight.png'] = ogPng;
outputs['images/audio-reader-highlight.webp'] = await sharp(ogPng)
  .webp({ quality: 90 })
  .toBuffer();

for (const [file, data] of Object.entries(outputs)) {
  await writeFile(pub(file), data);
  console.log(`public/${file}  ${data.length} bytes`);
}
