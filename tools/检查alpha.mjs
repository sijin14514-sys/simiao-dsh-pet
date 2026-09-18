// 检查若干 PNG 的透明像素占比（用于确认 VP9 alpha 是否保留）
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

for (const file of process.argv.slice(2)) {
  const png = PNG.sync.read(readFileSync(file));
  const total = png.width * png.height;
  let zero = 0, semi = 0;
  for (let i = 0; i < total; i++) {
    const a = png.data[i * 4 + 3];
    if (a < 8) zero++;
    else if (a < 248) semi++;
  }
  console.log(`${file}  ${png.width}x${png.height}  全透明 ${(100 * zero / total).toFixed(1)}%  半透明 ${(100 * semi / total).toFixed(1)}%`);
}
