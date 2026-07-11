// scripts/generate-icons.js
// 纯 JavaScript PNG 生成器，不依赖任何原生模块
// 使用 Node.js 内置 zlib 模块进行压缩

import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = `${__dirname}/../icons`;

/**
 * 生成 PNG 文件的字节
 * @param {number} size - 图标尺寸（正方形）
 * @param {boolean} maskable - 是否为 maskable 图标（需要安全区 padding）
 * @returns {Buffer} PNG 文件内容
 */
function generatePng(size, maskable = false) {
  const width = size;
  const height = size;

  // 构建原始像素数据（每行前加 filter byte 0）
  const rawData = [];

  // 背景色 #1a1a2e
  const bgR = 0x1a, bgG = 0x1a, bgB = 0x2e;

  // 前景色 #4a90d9（时钟轮廓）
  const fgR = 0x4a, fgG = 0x90, fgB = 0xd9;

  // 白色 #e0e0e0（时钟指针）
  const whR = 0xe0, whG = 0xe0, whB = 0xe0;

  const padding = maskable ? size * 0.1 : 0;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size - padding * 2) * 0.35;
  const lineWidth = size * 0.04;

  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte: None
    for (let x = 0; x < width; x++) {
      let r = bgR, g = bgG, b = bgB;

      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 时钟外圆轮廓
      if (Math.abs(dist - radius) < lineWidth / 2) {
        r = fgR; g = fgG; b = fgB;
      }

      // 时钟顶部按钮
      if (x > centerX - size * 0.04 && x < centerX + size * 0.04 &&
          y > centerY - radius - size * 0.08 && y < centerY - radius - size * 0.02) {
        r = fgR; g = fgG; b = fgB;
      }

      // 时针（向上）
      if (Math.abs(dx) < lineWidth / 2 && y < centerY && y > centerY - radius * 0.5) {
        r = whR; g = whG; b = whB;
      }

      // 分针（向右）
      if (Math.abs(dy) < lineWidth / 2 && x > centerX && x < centerX + radius * 0.7) {
        r = whR; g = whG; b = whB;
      }

      // 中心点
      if (dist < size * 0.025) {
        r = fgR; g = fgG; b = fgB;
      }

      rawData.push(r, g, b);
    }
  }

  // 构建 PNG 文件
  const png = [];

  // PNG 签名
  png.push(...[137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = [];
  ihdrData.push(...intToBytes(width));
  ihdrData.push(...intToBytes(height));
  ihdrData.push(8);  // bit depth
  ihdrData.push(2);  // color type: RGB
  ihdrData.push(0);  // compression
  ihdrData.push(0);  // filter
  ihdrData.push(0);  // interlace
  pushChunk(png, 'IHDR', ihdrData);

  // IDAT chunk (zlib compressed)
  const compressed = deflateSync(Buffer.from(rawData));
  pushChunk(png, 'IDAT', [...compressed]);

  // IEND chunk
  pushChunk(png, 'IEND', []);

  return Buffer.from(png);
}

function intToBytes(num) {
  return [
    (num >> 24) & 0xff,
    (num >> 16) & 0xff,
    (num >> 8) & 0xff,
    num & 0xff
  ];
}

function pushChunk(png, type, data) {
  const length = data.length;
  png.push(...intToBytes(length));

  const typeBytes = [...Buffer.from(type, 'ascii')];
  const crcInput = [...typeBytes, ...data];
  const crc = crc32(crcInput);
  png.push(...typeBytes);
  png.push(...data);
  png.push(...intToBytes(crc));
}

// CRC32 计算（PNG 使用 IEEE 802.3 CRC32）
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// 确保图标目录存在
mkdirSync(iconsDir, { recursive: true });

// 生成三个图标
const icons = [
  { size: 192, filename: 'icon-192.png', maskable: false },
  { size: 512, filename: 'icon-512.png', maskable: false },
  { size: 512, filename: 'icon-maskable-512.png', maskable: true }
];

for (const { size, filename, maskable } of icons) {
  const pngBuffer = generatePng(size, maskable);
  writeFileSync(`${iconsDir}/${filename}`, pngBuffer);
  console.log(`Generated: icons/${filename} (${size}x${size}${maskable ? ' maskable' : ''})`);
}

console.log('All icons generated successfully.');
