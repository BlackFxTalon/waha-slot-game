// Анализ фона: декодирует PNG без сторонних библиотек и находит
// тёмную центральную зону, в которую должна садиться сетка барабанов.
// Запуск: node tools/analyze-bg.mjs [path-to-png]
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { argv } from 'node:process';

const path = argv[2] ?? 'assets/background.png';

function decodePng(buf) {
  const buffer = ArrayBuffer.isView(buf) ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf;
  const u8 = new Uint8Array(buffer);
  if (u8[0] !== 0x89 || u8[1] !== 0x50) throw new Error('Не PNG');
  const view = new DataView(buffer);
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < u8.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(u8[off + 4], u8[off + 5], u8[off + 6], u8[off + 7]);
    if (type === 'IHDR') {
      width = view.getUint32(off + 8);
      height = view.getUint32(off + 12);
      bitDepth = u8[off + 16];
      colorType = u8[off + 17];
    } else if (type === 'IDAT') {
      idat.push(u8.subarray(off + 8, off + 8 + len));
    } else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bitDepth=' + bitDepth + ' не поддерживается');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const raw = new Uint8Array(width * height * channels);
  let pos = 0;
  const bpp = channels;
  for (const chunk of idat) {
    // Полный поток inflate делаем один раз ниже — собираем в один буфер
    void chunk; void pos;
    break;
  }
  const full = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of idat) { full.set(c, p); p += c.length; }
  const inflated = inflateSync(full);
  const stride = width * bpp;
  let ptr = 0;
  for (let y = 0; y < height; y++) {
    const filter = inflated[ptr++];
    const line = inflated.subarray(ptr, ptr + stride); ptr += stride;
    const out = raw.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = y > 0 ? raw[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? raw[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); break; }
      }
      out[x] = v & 0xff;
    }
  }
  return { width, height, channels, raw };
}

const img = decodePng(readFileSync(path));
const { width: W, height: H, channels, raw } = img;
console.log(`Размер: ${W}x${H}, каналов: ${channels}`);

// Люминанс по сетке (даунсемпл для скорости)
const GS = 120; // ширина сетки
const cellW = W / GS, cellH = cellW;
const GHS = Math.floor(H / cellH);
const lum = new Float32Array(GS * GHS);
for (let gy = 0; gy < GHS; gy++) {
  for (let gx = 0; gx < GS; gx++) {
    let sum = 0, n = 0;
    const x0 = Math.floor(gx * cellW), y0 = Math.floor(gy * cellH);
    for (let y = y0; y < Math.min(H, y0 + cellH); y += 3) {
      for (let x = x0; x < Math.min(W, x0 + cellW); x += 3) {
        const i = (y * W + x) * channels;
        sum += 0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2];
        n++;
      }
    }
    lum[gy * GS + gx] = sum / n;
  }
}

// Тёмный порог: центростремительный поиск — идём от центра наружу
// по каждой оси, пока доля тёмных пикселей в колонке/строке высокая.
const THRESH = 60; // люминанс тёмной зоны
const isDark = (v) => v < THRESH;

// Для каждой колонки сетки — доля тёмных в средней трети по высоте
const colDark = new Float32Array(GS);
const rowDark = new Float32Array(GHS);
for (let gx = 0; gx < GS; gx++) {
  let d = 0, n = 0;
  for (let gy = Math.floor(GHS / 3); gy < Math.floor((2 * GHS) / 3); gy++) { if (isDark(lum[gy * GS + gx])) d++; n++; }
  colDark[gx] = d / n;
}
for (let gy = 0; gy < GHS; gy++) {
  let d = 0, n = 0;
  for (let gx = Math.floor(GS / 3); gx < Math.floor((2 * GS) / 3); gx++) { if (isDark(lum[gy * GS + gx])) d++; n++; }
  rowDark[gy] = d / n;
}

// Центральный непрерывный диапазон, где доля тёмных > 0.9
const FRAC = 0.9;
function centralRange(arr, frac) {
  const mid = Math.floor(arr.length / 2);
  let a = mid, b = mid;
  while (a > 0 && arr[a - 1] >= frac) a--;
  while (b < arr.length - 1 && arr[b + 1] >= frac) b++;
  return [a, b];
}
const [cx0, cx1] = centralRange(colDark, FRAC);
const [cy0, cy1] = centralRange(rowDark, FRAC);
const x0 = (cx0 * cellW) / W, x1 = ((cx1 + 1) * cellW) / W;
const y0 = (cy0 * cellH) / H, y1 = ((cy1 + 1) * cellH) / H;
console.log(`Тёмная зона: x ∈ [${x0.toFixed(3)}, ${x1.toFixed(3)}], y ∈ [${y0.toFixed(3)}, ${y1.toFixed(3)}]`);
console.log(`В пикселях фона: x ∈ [${Math.round(x0 * W)}, ${Math.round(x1 * W)}], y ∈ [${Math.round(y0 * H)}, ${Math.round(y1 * H)}]`);
console.log(`Пропорции зоны: ${(((x1 - x0) * W) / ((y1 - y0) * H)).toFixed(3)} (для 5:3 нужно 1.667)`);
console.log(`Требуемая зона при ячейке = zoneH/3: ширина ${(5 * ((y1 - y0) * H) / 3 / W).toFixed(3)}W, доступно ${((x1 - x0)).toFixed(3)}W`);
