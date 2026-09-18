import { fileURLToPath } from 'node:url';
// 把即梦生成的绿幕 mp4 处理成 dsh-pet 能播的动画帧：
//   抽帧 → HSV 色相抠绿（与项目 chroma_step02.py 同思路）→ 按站立高度归一化 →
//   合成到 640×360 画布（底边 y=330，水平居中）→ 交给 工具/编码.ps1 转 VP9-alpha webm
//
// 用法：node 工具/视频转桌宠.mjs <输入mp4> <动画名>
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const [, , input, animName] = process.argv;
if (!input || !animName) {
  console.error('用法：node 工具/视频转桌宠.mjs <输入mp4> <动画名>');
  process.exit(1);
}

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/, '') + '\\';
const FFMPEG = readdirSync(ROOT + '工具\\ffmpeg', { recursive: true })
  .map(String).filter((f) => f.endsWith('ffmpeg.exe')).map((f) => ROOT + '工具\\ffmpeg\\' + f)[0];
const SRC_DIR = ROOT + '临时\\源帧';
const OUT_DIR = ROOT + '临时\\帧\\' + animName;
const FPS = 24;
const CANVAS_W = 640, CANVAS_H = 360, GROUND_Y = 330;
const TARGET_CHAR_H = 267;   // 母版站立高度 900 ÷ 3.375

if (!existsSync(FFMPEG)) { console.error('找不到 ffmpeg'); process.exit(1); }

console.log('1) 抽帧');
rmSync(SRC_DIR, { recursive: true, force: true });
mkdirSync(SRC_DIR, { recursive: true });
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', input, '-vf', `fps=${FPS}`, SRC_DIR + '\\f_%04d.png'], { stdio: 'inherit' });
const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.png')).sort();
console.log(`   ${files.length} 帧（${(files.length / FPS).toFixed(1)}s）`);

// HSV 抠绿（与项目 chroma_step02.py 同一判定：色相 70~170、饱和度/明度达标）
const HUE_MIN = 70, HUE_MAX = 170, SAT_MIN = 0.15, VAL_MIN = 0.15, FEATHER = 6;
function keyGreen(png) {
  const { width: w, height: h, data } = png;
  // 先清掉左上角平台水印（该区域是纯绿背景，被抠成透明后仍会残留半透明灰字）
  const wmW = Math.round(w * 0.2), wmH = Math.round(h * 0.12);
  for (let y = 0; y < wmH; y++) {
    for (let x = 0; x < wmW; x++) {
      const o = (y * w + x) * 4;
      data[o + 3] = 0;
    }
  }
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hue = 0;
    if (d > 0) {
      if (mx === r) hue = 60 * (((g - b) / d) % 6);
      else if (mx === g) hue = 60 * ((b - r) / d + 2);
      else hue = 60 * ((r - g) / d + 4);
    }
    if (hue < 0) hue += 360;
    const sat = mx > 0 ? d / mx : 0;
    const inGreen = hue >= HUE_MIN - FEATHER && hue <= HUE_MAX + FEATHER && sat >= SAT_MIN && mx >= VAL_MIN;
    if (!inGreen) continue;
    const core = hue >= HUE_MIN && hue <= HUE_MAX;
    data[o + 3] = core ? 0 : Math.round(data[o + 3] * (1 - Math.min(1, (FEATHER - Math.min(Math.abs(hue - HUE_MIN), Math.abs(hue - HUE_MAX))) / FEATHER)));
  }
  return png;
}

/** 不透明内容的包围盒 */
function bbox(png) {
  const { width: w, height: h, data } = png;
  let x1 = w, y1 = h, x2 = -1, y2 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 24) continue;
      if (x < x1) x1 = x; if (y < y1) y1 = y; if (x > x2) x2 = x; if (y > y2) y2 = y;
    }
  }
  return x2 < 0 ? null : { x1, y1, x2, y2, w: x2 - x1 + 1, h: y2 - y1 + 1 };
}

console.log('2) 抠绿 + 测量');
const frames = [];
for (const [i, f] of files.entries()) {
  const png = keyGreen(PNG.sync.read(readFileSync(SRC_DIR + '\\' + f)));
  frames.push(png);
  if (i === 0 || i === files.length - 1) {
    const b = bbox(png);
    console.log(`   帧 ${i === 0 ? '首' : '尾'} bbox: ${b ? `${b.w}x${b.h} @(${b.x1},${b.y1})` : '空'}`);
  }
}

// 用首尾两帧的中位高度/脚底定标（避免逐帧抖动）
const refs = [bbox(frames[0]), bbox(frames[frames.length - 1])].filter(Boolean);
const refH = refs.reduce((s, b) => s + b.h, 0) / refs.length;
const refBottom = refs.reduce((s, b) => s + b.y2, 0) / refs.length;
const refCenterX = refs.reduce((s, b) => s + (b.x1 + b.x2) / 2, 0) / refs.length;
const scale = TARGET_CHAR_H / refH;
console.log(`   站立高度 ${refH.toFixed(0)}px → 缩放 ${scale.toFixed(3)}；脚底 y=${refBottom.toFixed(0)}，中心 x=${refCenterX.toFixed(0)}`);

console.log('3) 归一化合成 640x360');
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const canvas = Buffer.alloc(CANVAS_W * CANVAS_H * 4);
for (const [i, frame] of frames.entries()) {
  canvas.fill(0);
  for (let y = 0; y < CANVAS_H; y++) {
    // 目标像素 → 源图坐标（等比缩放 + 平移）
    const sy = refBottom + (y - GROUND_Y) / scale;
    if (sy < 0 || sy >= frame.height) continue;
    for (let x = 0; x < CANVAS_W; x++) {
      const sx = refCenterX + (x - CANVAS_W / 2) / scale;
      if (sx < 0 || sx >= frame.width) continue;
      const so = ((sy | 0) * frame.width + (sx | 0)) * 4;
      const a = frame.data[so + 3];
      if (a === 0) continue;
      const to = (y * CANVAS_W + x) * 4;
      canvas[to] = frame.data[so]; canvas[to + 1] = frame.data[so + 1]; canvas[to + 2] = frame.data[so + 2]; canvas[to + 3] = a;
    }
  }
  const out = new PNG({ width: CANVAS_W, height: CANVAS_H });
  canvas.copy(out.data);
  writeFileSync(OUT_DIR + `\\frame_${String(i).padStart(4, '0')}.png`, PNG.sync.write(out, { deflateLevel: 1 }));
}
console.log(`   ${frames.length} 帧 → ${OUT_DIR}`);
console.log('下一步：powershell -File 工具/编码.ps1（会把 临时/帧 下所有目录都编码成 webm）');
