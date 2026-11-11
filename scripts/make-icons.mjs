// Renders the PNG images that can't be SVG: the link-preview card (og.png) and the
// phone home-screen icon (apple-touch-icon.png). Run with `npm run icons` after changing the logo.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const pub = new URL('../public/', import.meta.url);

const mark = `
  <path d="M32 3 L57 11 V30 C57 46 46 57 32 61 C18 57 7 46 7 30 V11 Z" fill="#d9a83a"/>
  <path d="M32 3 L57 11 V30 C57 46 46 57 32 61 Z" fill="#c69326"/>
  <path d="M32 7 L53 13.8 V30 C53 44 44 53.5 32 57 C20 53.5 11 44 11 30 V13.8 Z" fill="#6fb0ff"/>
  <path d="M32 9 L51 15 V30 C51 43 43 51.5 32 55 C21 51.5 13 43 13 30 V15 Z" fill="#151c2f"/>
  <rect x="17" y="35" width="9" height="11" rx="1" fill="#b4bfd0"/>
  <rect x="27.5" y="28" width="9" height="18" rx="1" fill="#e0b04a"/>
  <rect x="38" y="39" width="9" height="7" rx="1" fill="#cf8a5c"/>
  <path d="M32 11.5 L37.5 19 L32 26.5 L26.5 19 Z" fill="#3d8bff"/>
  <path d="M32 11.5 L37.5 19 L32 19 Z" fill="#9ccaff"/>
  <path d="M26.5 19 L32 19 L32 26.5 Z" fill="#2a6fd6"/>`;

// 1200 x 630 link-preview card.
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0d1220"/>
  <rect x="0" y="600" width="1200" height="30" fill="#151c2f"/>
  <rect x="0" y="600" width="1200" height="3" fill="#d9a83a"/>
  <g transform="translate(110 155) scale(5)">${mark}</g>
  <text x="480" y="300" font-family="Cinzel, Trajan Pro, Georgia, serif" font-weight="700" font-size="76" fill="#e7ebf4" letter-spacing="1">Event Rankings</text>
  <text x="482" y="370" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="34" fill="#9aa4ba">AFK Arena Companions event results,</text>
  <text x="482" y="415" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="34" fill="#9aa4ba">guild and player rankings season by season</text>
  <text x="482" y="500" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="30" fill="#6fb0ff">event-rankings.edenafk.com</text>
</svg>`;

// 180 x 180 home-screen icon (iOS rounds the corners itself).
const touch = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="#0d1220"/>
  <g transform="translate(26 24) scale(2)">${mark}</g>
</svg>`;

await writeFile(new URL('og.png', pub), await sharp(Buffer.from(og)).png().toBuffer());
await writeFile(new URL('apple-touch-icon.png', pub), await sharp(Buffer.from(touch)).png().toBuffer());
console.log('Wrote public/og.png and public/apple-touch-icon.png');
