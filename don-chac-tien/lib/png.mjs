// Minimal PNG writer (8-bit grayscale, stored/uncompressed deflate). No dependencies, runs in Workers.
// Zalo and banking apps need a real image (PNG), not SVG.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function chunk(type, data) {
  const td = [...type].map((ch) => ch.charCodeAt(0)).concat(Array.from(data));
  return [...u32(data.length), ...td, ...u32(crc32(td))];
}

/** pixels: Uint8Array of width*height gray values (0 = black, 255 = white) → PNG bytes */
export function grayPng(width, height, pixels) {
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter: none
    raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  // zlib stream with stored blocks (max 65535 bytes each)
  const z = [0x78, 0x01];
  for (let i = 0; i < raw.length; i += 65535) {
    const blk = raw.subarray(i, Math.min(i + 65535, raw.length));
    const last = i + 65535 >= raw.length ? 1 : 0;
    z.push(last, blk.length & 255, blk.length >>> 8, ~blk.length & 255, (~blk.length >>> 8) & 255);
    for (const b of blk) z.push(b);
  }
  let a = 1; let b = 0;
  for (const v of raw) { a = (a + v) % 65521; b = (b + a) % 65521; }
  z.push(...u32(((b << 16) | a) >>> 0));
  const ihdr = [...u32(width), ...u32(height), 8, 0, 0, 0, 0];
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', ihdr), ...chunk('IDAT', z), ...chunk('IEND', [])]);
}

/** QR matrix → PNG bytes. scale = pixels per module, border = quiet zone modules. */
export function qrPng(qr, { scale = 8, border = 4 } = {}) {
  const n = (qr.size + border * 2) * scale;
  const px = new Uint8Array(n * n).fill(255);
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
    if (!qr.get(x, y)) continue;
    for (let dy = 0; dy < scale; dy++) px.fill(0, ((y + border) * scale + dy) * n + (x + border) * scale, ((y + border) * scale + dy) * n + (x + border + 1) * scale);
  }
  return grayPng(n, n, px);
}
