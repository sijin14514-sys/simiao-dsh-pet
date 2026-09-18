import { fileURLToPath } from 'node:url';
// 下载新结果（只认还没入库的动作），四道验收：哈希查重 / 纯绿幕 / 角色未贴画幅底边 / 文件完整
import { readFileSync, existsSync, unlinkSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/, '') + '\\';
const LIST = JSON.parse(readFileSync(ROOT + '提示词\\即梦-动作清单.json', 'utf8'));
const rows = JSON.parse(readFileSync(ROOT + '临时\\全部结果.json', 'utf8'));
const FFMPEG = (() => {
  const stack = [ROOT + '工具\\ffmpeg'];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = dir + '\\' + e.name;
      if (e.isDirectory()) stack.push(p);
      else if (e.name === 'ffmpeg.exe') return p;
    }
  }
  throw new Error('找不到 ffmpeg');
})();

const post = async (body) => {
  const res = await fetch('http://127.0.0.1:7799/cmd', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) console.log('  ⚠', body.action, '→', json.error);
  return json.result;
};
const hashOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);

/** 抽一帧 rgb24，检查：背景是纯绿幕 + 角色没贴到画幅底边 */
function inspect(mp4) {
  const tmp = ROOT + '临时\\qc5.png';
  try {
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '2.5', '-i', mp4, '-frames:v', '1', '-pix_fmt', 'rgb24', tmp], { stdio: 'ignore' });
    const png = PNG.sync.read(readFileSync(tmp));   // 注意：ffmpeg 写的是 4 通道 PNG
    const ch = png.data.length / (png.width * png.height);
    const wmW = Math.round(png.width * 0.22), wmH = Math.round(png.height * 0.14);
    const counts = [];
    let greenCorners = 0;
    for (const [x, y] of [[png.width - 20, 20], [20, png.height - 20], [png.width - 20, png.height - 20]]) {
      const o = (y * png.width + x) * ch;
      const r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      if (g > 150 && g > r * 1.4 && g > b * 1.4) greenCorners++;
    }
    for (let y = 0; y < png.height; y++) {
      let n = 0;
      for (let x = 0; x < png.width; x++) {
        if (x < wmW && y < wmH) continue;
        const o = (y * png.width + x) * ch;
        const r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
        if (!(g > 110 && g > r * 1.25 && g > b * 1.25)) n++;
      }
      counts.push(n);
    }
    const TH = 30;
    let last = -1;
    for (let y = counts.length - 1; y >= 0; y--) if (counts[y] > TH) { last = y; break; }
    const gap = png.height - 1 - last;
    return { greenCorners, gap, ok: greenCorners >= 2 && gap >= 8 };
  } catch (e) {
    return { ok: false, gap: -1, greenCorners: 0, err: e.message };
  }
}

const existing = new Set(readdirSync(ROOT + '视频源').filter((f) => f.endsWith('.mp4')).map((f) => hashOf(ROOT + '视频源\\' + f)));
const descriptions = Object.entries(LIST.动作);
const done = new Set(readdirSync(ROOT + 'pet\\simiao-animation').filter((f) => f.endsWith('.webm')).map((f) => f.replace('.webm', '')));
const claimed = [];
const rejected = [];

for (const row of rows) {
  const hit = descriptions.find(([, d]) => row.desc === d || row.desc.includes(d.slice(0, 16)) || d.includes(row.desc.slice(0, 16)));
  if (!hit) continue;
  const name = hit[0];
  if (done.has(name)) continue;                       // 已入库，跳过
  const outPath = ROOT + `视频源\\${name}.mp4`;
  if (existsSync(outPath)) continue;

  const r = await post({ action: 'saveUrl', url: row.src, path: outPath });
  if (!r || !r.bytes) { rejected.push(`${name}（下载失败）`); continue; }
  const hash = hashOf(outPath);
  if (existing.has(hash)) { unlinkSync(outPath); rejected.push(`${name}（重复）`); continue; }
  const qc = inspect(outPath);
  if (!qc.ok) {
    unlinkSync(outPath);
    rejected.push(`${name}（${qc.greenCorners < 2 ? '背景不像绿幕' : '角色贴到画幅底边＝腿被裁'}，需重做）`);
    continue;
  }
  existing.add(hash);
  claimed.push({ name, mb: (r.bytes / 1048576).toFixed(2), gap: qc.gap });
  console.log(`  ✓ ${name}  ${(r.bytes / 1048576).toFixed(2)} MB  距画幅底 ${qc.gap}px`);
}

console.log('\n新入库:', claimed.map((c) => c.name).join('、') || '（无）');
if (rejected.length) console.log('被拦下:', rejected.join('；'));
writeFileSync(ROOT + '临时\\新入库.json', JSON.stringify({ claimed, rejected }, null, 2));
