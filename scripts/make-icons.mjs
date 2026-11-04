// Renders every icon/splash PNG from assets/icon.svg. Run with: node scripts/make-icons.mjs
// Then `npx capacitor-assets generate --android` turns assets/*.png into the Android launcher icons.
import sharp from 'sharp';
import {readFileSync} from 'node:fs';

const svg = readFileSync('assets/icon.svg', 'utf8');
const plateOnly = svg.replace(/<rect[^>]*\/>/, '');
const BG = '#D8432A', BG_DARK = '#0F1613';
const png = (src, size, out) => sharp(Buffer.from(src), {density: 72 * size / 512}).resize(size, size).png().toFile(out);

// PWA
await png(svg, 192, 'public/pwa-192x192.png');
await png(svg, 512, 'public/pwa-512x512.png');
await png(svg, 512, 'public/maskable-icon-512x512.png'); // plate sits well inside the 80% safe zone
await png(svg, 180, 'public/apple-touch-icon-180x180.png');

// Capacitor assets sources
await png(svg, 1024, 'assets/icon-only.png');
await png(plateOnly, 1024, 'assets/icon-foreground.png');
await sharp({create: {width: 1024, height: 1024, channels: 4, background: BG}}).png().toFile('assets/icon-background.png');
const plate = await sharp(Buffer.from(plateOnly), {density: 72 * 900 / 512}).resize(900, 900).png().toBuffer();
for (const [name, bg] of [['splash', '#EEF1EA'], ['splash-dark', BG_DARK]]) {
  await sharp({create: {width: 2732, height: 2732, channels: 4, background: bg}})
    .composite([{input: plate, gravity: 'center'}]).png().toFile(`assets/${name}.png`);
}
console.log('icons written');
