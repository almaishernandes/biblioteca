import sharp from 'sharp';
import { mkdirSync } from 'fs';

mkdirSync('public/icons', { recursive: true });

const svg = 'scripts/icon.svg';
const sizes = [180, 192, 512];

for (const size of sizes) {
  const outName = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  const dest = size === 180 ? `public/${outName}` : `public/icons/${outName}`;
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(dest);
  console.log('wrote', dest);
}

// maskable version with extra padding so the mark isn't clipped by OS masks
await sharp(svg, { density: 384 })
  .resize(320, 320)
  .extend({ top: 96, bottom: 96, left: 96, right: 96, background: '#2C2C2C' })
  .png()
  .toFile('public/icons/icon-512-maskable.png');
console.log('wrote public/icons/icon-512-maskable.png');

// favicon
await sharp(svg, { density: 384 }).resize(32, 32).png().toFile('public/favicon.png');
console.log('wrote public/favicon.png');
