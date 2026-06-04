// Generate PWA PNG icons with no image dependency: a brand-green tile with a
// white shopping-bag glyph. Run with `node scripts/gen-icons.mjs`. The output is
// committed under public/ so the build doesn't need this at runtime. Replace the
// PNGs with your own art any time.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const GREEN = [21, 128, 61];
const WHITE = [255, 255, 255];

// A simple shopping bag: rounded rectangle body + handle arc, centered.
function bagPixel(x, y, size, bleed) {
  const u = x / size;
  const v = y / size;
  // Background (full bleed for maskable; rounded for normal).
  let bg = GREEN;
  if (!bleed) {
    const r = 0.18;
    const cx = Math.min(Math.max(u, r), 1 - r);
    const cy = Math.min(Math.max(v, r), 1 - r);
    const d = Math.hypot(u - cx, v - cy);
    if (d > r) return [0, 0, 0, 0];
  }
  // Bag body
  const bx0 = 0.34, bx1 = 0.66, by0 = 0.44, by1 = 0.72;
  const inBody = u > bx0 && u < bx1 && v > by0 && v < by1;
  // Handle (two vertical strokes + arc)
  const handleTop = 0.34;
  const arc = Math.abs(Math.hypot(u - 0.5, v - by0) - 0.085) < 0.018 && v < by0 && v > handleTop;
  const stroke =
    (Math.abs(u - (0.5 - 0.085)) < 0.018 || Math.abs(u - (0.5 + 0.085)) < 0.018) && v > handleTop && v < by0 + 0.02;
  if (inBody || arc || stroke) return [...WHITE, 255];
  return [...bg, 255];
}

const targets = [
  { name: "icon-192.png", size: 192, bleed: false },
  { name: "icon-512.png", size: 512, bleed: false },
  { name: "maskable-512.png", size: 512, bleed: true },
  { name: "apple-touch-icon.png", size: 180, bleed: true },
];
for (const t of targets) {
  const buf = png(t.size, (x, y, s) => bagPixel(x, y, s, t.bleed));
  writeFileSync(join(OUT, t.name), buf);
  console.log(`wrote public/${t.name} (${buf.length} bytes)`);
}
