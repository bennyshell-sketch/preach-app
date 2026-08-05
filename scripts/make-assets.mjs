/**
 * Generate the app icons.
 *
 * Written as code rather than committed binaries so the marks stay in step with
 * the palette in tailwind.config.js — change the gold there and re-run this.
 * A real launch would replace these with designed artwork; they exist so that
 * `expo prebuild` and EAS Build have valid, correctly-sized assets from day one.
 *
 *   node scripts/make-assets.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../assets');

const SCREEN = [0x07, 0x09, 0x0f];
const GOLD = [0xc9, 0xa8, 0x6c];
const VIOLET = [0x8b, 0x6f, 0xd0];

/** 5x7 bitmap of the letter P — the app mark. */
const GLYPH_P = [
  '11110',
  '10001',
  '10001',
  '11110',
  '10000',
  '10000',
  '10000',
];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, paint) {
  // RGBA scanlines, each prefixed with a zero filter byte.
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a = 255] = paint(x, y, size);
      const offset = y * stride + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Gold-to-violet diagonal, as on the profile avatar. */
function gradientAt(x, y, size) {
  const t = (x / size + y / size) / 2;
  return [
    Math.round(GOLD[0] + (VIOLET[0] - GOLD[0]) * t),
    Math.round(GOLD[1] + (VIOLET[1] - GOLD[1]) * t),
    Math.round(GOLD[2] + (VIOLET[2] - GOLD[2]) * t),
  ];
}

function drawGlyph(x, y, size, scale, offsetY = 0) {
  const glyphW = 5 * scale;
  const glyphH = 7 * scale;
  const left = Math.round((size - glyphW) / 2);
  const top = Math.round((size - glyphH) / 2) + offsetY;

  const col = Math.floor((x - left) / scale);
  const row = Math.floor((y - top) / scale);

  if (col < 0 || col > 4 || row < 0 || row > 6) return false;
  return GLYPH_P[row][col] === '1';
}

mkdirSync(OUT, { recursive: true });

// ── icon.png — full-bleed mark on the app background ──────────────────────
writeFileSync(
  join(OUT, 'icon.png'),
  png(1024, (x, y, size) => {
    const scale = Math.round(size / 9);
    if (drawGlyph(x, y, size, scale)) return gradientAt(x, y, size);
    return SCREEN;
  }),
);

// ── adaptive-icon.png — Android foreground; must survive a circular mask, so
//    the mark is kept inside the safe 66% centre ───────────────────────────
writeFileSync(
  join(OUT, 'adaptive-icon.png'),
  png(1024, (x, y, size) => {
    const scale = Math.round(size / 14);
    if (drawGlyph(x, y, size, scale)) return gradientAt(x, y, size);
    return [0, 0, 0, 0];
  }),
);

// ── splash.png — mark on transparency, letting backgroundColor show ───────
writeFileSync(
  join(OUT, 'splash.png'),
  png(512, (x, y, size) => {
    const scale = Math.round(size / 11);
    if (drawGlyph(x, y, size, scale)) return [...GOLD, 255];
    return [0, 0, 0, 0];
  }),
);

// ── notification-icon.png — Android tints this, so it must be a white
//    silhouette on transparency ───────────────────────────────────────────
writeFileSync(
  join(OUT, 'notification-icon.png'),
  png(96, (x, y, size) => {
    const scale = Math.round(size / 9);
    if (drawGlyph(x, y, size, scale)) return [255, 255, 255, 255];
    return [0, 0, 0, 0];
  }),
);

// ── favicon.png — for the optional web build ──────────────────────────────
writeFileSync(
  join(OUT, 'favicon.png'),
  png(48, (x, y, size) => {
    const scale = Math.round(size / 9);
    if (drawGlyph(x, y, size, scale)) return gradientAt(x, y, size);
    return SCREEN;
  }),
);

console.log('✓ wrote icon, adaptive-icon, splash, notification-icon, favicon to assets/');
