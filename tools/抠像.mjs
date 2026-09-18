// 肆喵喵 demo · 第 1 步：源图 → 透明立绘（Node + pngjs，无需 Python 依赖）
//
// 两种输入分别处理：
//   1) 源图已带 alpha（当前这张证件照：23.7% 全透明背景）——直接用它，不做任何 keying，
//      避免误伤黑色镜框/描边（全局白色 key 或按角落取色都会翻车）。
//   2) 源图完全不透明（白底截图/照片）——从画幅四边向内泛洪：只有与边缘连通的近白像素
//      才算背景，被深色描边包围的白头饰始终是前景。
//
// 输出：立绘/肆喵-抠像.png（裁到内容 bbox）＋ 临时/抠像-检查.png（棋盘格预览）
// 用法：node 工具/抠像.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const ROOT = new URL('../', import.meta.url);
const SRC = new URL('立绘/肆喵证件照.png', ROOT);
const DST = new URL('立绘/肆喵-抠像.png', ROOT);
const PREVIEW = new URL('临时/抠像-检查.png', ROOT);

const TOL = 14;          // 泛洪兜底：与背景基准色通道差 ≤ TOL 视为纯背景
const FEATHER_TOL = 46;  // 泛洪兜底：TOL..FEATHER_TOL 线性羽化

const src = PNG.sync.read(readFileSync(SRC));
const { width: w, height: h, data } = src;
const at = (x, y) => (y * w + x) * 4;

let transparent = 0;
for (let p = 0; p < w * h; p++) if (data[p * 4 + 3] < 250) transparent++;
const hasAlpha = transparent > w * h * 0.01;

if (hasAlpha) {
  console.log(`源图 ${w}x${h} 自带 alpha（${(100 * transparent / (w * h)).toFixed(1)}% 像素非全不透明）——直接沿用，不做 keying`);
} else {
  const cornerSamples = [];
  for (const [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const o = at(Math.min(Math.max(cx + dx, 0), w - 1), Math.min(Math.max(cy + dy, 0), h - 1));
        cornerSamples.push([data[o], data[o + 1], data[o + 2]]);
      }
    }
  }
  const bg = [0, 1, 2].map((i) => cornerSamples.map((c) => c[i]).sort((a, b) => a - b)[cornerSamples.length >> 1]);
  console.log(`源图 ${w}x${h} 全不透明 → 按背景色 RGB(${bg.join(',')}) 从四边泛洪抠像`);
  const dist = (o) => Math.max(Math.abs(data[o] - bg[0]), Math.abs(data[o + 1] - bg[1]), Math.abs(data[o + 2] - bg[2]));

  const visited = new Uint8Array(w * h);
  const queue = [];
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const p = y * w + x;
      if (!visited[p] && dist(at(x, y)) <= FEATHER_TOL) { visited[p] = 1; queue.push(p); }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const p = y * w + x;
      if (!visited[p] && dist(at(x, y)) <= FEATHER_TOL) { visited[p] = 1; queue.push(p); }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    const x = p % w, y = (p - x) / w;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (visited[np] || dist(at(nx, ny)) > FEATHER_TOL) continue;
      visited[np] = 1;
      queue.push(np);
    }
  }
  for (let p = 0; p < w * h; p++) {
    if (!visited[p]) continue;
    const o = p * 4, d = dist(o);
    data[o + 3] = d <= TOL ? 0 : Math.round((255 * (d - TOL)) / (FEATHER_TOL - TOL));
  }
  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = data[p * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, weight = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
          sum += alpha[ny * w + nx] * k;
          weight += k;
        }
      }
      data[(y * w + x) * 4 + 3] = Math.round(sum / weight);
    }
  }
  console.log(`泛洪移除背景像素 ${queue.length}（${(100 * queue.length / (w * h)).toFixed(1)}%）`);
}

// 裁到内容 bbox（alpha > 0），四周留 1px
let x1 = w, y1 = h, x2 = -1, y2 = -1;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (data[at(x, y) + 3] === 0) continue;
    if (x < x1) x1 = x;
    if (y < y1) y1 = y;
    if (x > x2) x2 = x;
    if (y > y2) y2 = y;
  }
}
if (x2 < 0) throw new Error('抠像后没有任何不透明像素，请检查源图');
x1 = Math.max(0, x1 - 1); y1 = Math.max(0, y1 - 1);
x2 = Math.min(w - 1, x2 + 1); y2 = Math.min(h - 1, y2 + 1);
const cw = x2 - x1 + 1, ch = y2 - y1 + 1;
const cut = new PNG({ width: cw, height: ch });
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const from = at(x1 + x, y1 + y), to = (y * cw + x) * 4;
    cut.data[to] = data[from]; cut.data[to + 1] = data[from + 1];
    cut.data[to + 2] = data[from + 2]; cut.data[to + 3] = data[from + 3];
  }
}
writeFileSync(DST, PNG.sync.write(cut));
console.log(`内容 bbox (${x1},${y1})-(${x2},${y2}) → 立绘/肆喵-抠像.png ${cw}x${ch}`);

// 预览：叠在 16px 棋盘格上，肉眼确认边缘
mkdirSync(new URL('临时/', ROOT), { recursive: true });
const board = new PNG({ width: cw, height: ch });
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const o = (y * cw + x) * 4;
    const base = ((x >> 4) + (y >> 4)) % 2 === 0 ? 255 : 200;
    const t = cut.data[o + 3] / 255;
    board.data[o] = Math.round(cut.data[o] * t + base * (1 - t));
    board.data[o + 1] = Math.round(cut.data[o + 1] * t + base * (1 - t));
    board.data[o + 2] = Math.round(cut.data[o + 2] * t + base * (1 - t));
    board.data[o + 3] = 255;
  }
}
writeFileSync(PREVIEW, PNG.sync.write(board));
console.log('预览（棋盘格）：临时/抠像-检查.png');
