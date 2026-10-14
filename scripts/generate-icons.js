/**
 * Generates valid PNG icons and SVG favicon for Zen2048 using Node built-in zlib & fs.
 * No external dependencies required!
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makePng(width, height, getPixelRgba) {
  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel;
  const rawData = Buffer.alloc((scanlineLength + 1) * height);

  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (scanlineLength + 1);
    rawData[scanlineOffset] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRgba(x, y, width, height);
      const pixelOffset = scanlineOffset + 1 + x * bytesPerPixel;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([typeBuf, data]);
    const crcVal = crc32(body);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([lenBuf, body, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function renderIcon(x, y, w, h) {
  const nx = (x - w / 2) / (w / 2);
  const ny = (y - h / 2) / (h / 2);

  // Rounded outer rect
  if (Math.abs(nx) > 0.92 || Math.abs(ny) > 0.92) {
    return [0, 0, 0, 0];
  }

  // Base background: deep slate to twilight indigo (#0f172a to #1e1b4b)
  const grad = (ny + 1) * 0.5;
  let bgR = Math.round(15 + grad * 15);
  let bgG = Math.round(23 + grad * 4);
  let bgB = Math.round(42 + grad * 33);

  // 2x2 stylized tile grid inside
  // cell coordinates in [-0.75, 0.75]
  const cellMargin = 0.06;
  const inGridX = Math.abs(nx) < 0.75;
  const inGridY = Math.abs(ny) < 0.75;

  if (inGridX && inGridY) {
    const col = nx < 0 ? 0 : 1;
    const row = ny < 0 ? 0 : 1;
    const cx = col === 0 ? -0.4 : 0.4;
    const cy = row === 0 ? -0.4 : 0.4;
    const distToCenter = Math.max(Math.abs(nx - cx), Math.abs(ny - cy));

    if (distToCenter < (0.35 - cellMargin)) {
      // 4 distinct warm tile colors:
      // Top-Left (2048 gold): #f59e0b
      // Top-Right (1024 amber): #f97316
      // Bottom-Left (512 coral): #ec4899
      // Bottom-Right (256 violet): #8b5cf6
      if (row === 0 && col === 0) {
        return [245, 158, 11, 255]; // Gold
      } else if (row === 0 && col === 1) {
        return [249, 115, 22, 255]; // Amber
      } else if (row === 1 && col === 0) {
        return [236, 72, 153, 255]; // Coral
      } else {
        return [139, 92, 246, 255]; // Violet
      }
    }
  }

  // Border glow
  const borderDist = Math.max(Math.abs(nx), Math.abs(ny));
  if (borderDist >= 0.85 && borderDist <= 0.91) {
    return [245, 158, 11, 180];
  }

  return [bgR, bgG, bgB, 255];
}

const targetDir = path.join(__dirname, '..', 'src');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Write PNGs
const png192 = makePng(192, 192, renderIcon);
fs.writeFileSync(path.join(targetDir, 'icon-192.png'), png192);

const png512 = makePng(512, 512, renderIcon);
fs.writeFileSync(path.join(targetDir, 'icon-512.png'), png512);

// Write SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <!-- 2x2 stylized tiles -->
  <rect x="76" y="76" width="160" height="160" rx="24" fill="url(#gold)"/>
  <rect x="276" y="76" width="160" height="160" rx="24" fill="#f97316"/>
  <rect x="76" y="276" width="160" height="160" rx="24" fill="#ec4899"/>
  <rect x="276" y="276" width="160" height="160" rx="24" fill="#8b5cf6"/>
  <!-- Central "2048" text -->
  <text x="256" y="276" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.5))">2048</text>
</svg>`;

fs.writeFileSync(path.join(targetDir, 'favicon.svg'), svgContent);
console.log('Zen2048 icons generated successfully: icon-192.png, icon-512.png, favicon.svg');
