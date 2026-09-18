import { fileURLToPath } from 'node:url';
// 批量生成 v2：比 v1 多三道闸门
//   ① 首帧闸门：必须出现 720px 宽的 blob: 预览图（不是"有几张 blob 图"）
//   ② 重复闸门：下载后比对已保存文件的 sha256，重复即判失败
//   ③ 画风闸门：抽一帧采样四角背景色，必须是纯绿幕（渐变绿/写实风会被拦下）
// 只有三条都过才保留文件；任何一条不过就删掉并重试该动作（最多 3 次）。
//
// 用法：node 工具/即梦-26-批量生成v2.mjs [起始序号]
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/, '') + '\\';
const LIST = JSON.parse(readFileSync(ROOT + '提示词\\即梦-动作清单.json', 'utf8'));
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

const LOCK = '【角色锁定】严格保持首帧中的角色外貌完全不变：棕色蓬松短发（额前一缕呆毛）、头顶一对猫耳（内侧粉色）、白色蕾丝女仆头饰、黑色方框眼镜、橙色圆眼、白色围裙女仆装与深色缎带领结。严禁改变发色、发型、眼镜、服装与配色，严禁换成其他角色。';
const TAIL = '镜头完全固定，人物水平位置不变、不移动、不出画；背景保持纯绿幕色 #00FF00 完全不变，无阴影、无杂物、无文字、无水印；最后一帧回到与首帧完全一致的正面站立姿态。';
const promptFor = (name) => `${LOCK}动作：${LIST.动作[name]} ${TAIL}`;

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...a);

const readState = () => post({
  action: 'eval',
  js: `(() => {
    const text = document.body.innerText.replace(/\\s+/g, ' ');
    const credits = Number((text.match(/\\+?\\s*(\\d+)\\s*基础会员/) || [])[1] ?? -1);
    const tasks = [...document.querySelectorAll('a,div,li,span,p')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.x < 260 && r.y > 150 && r.y < 560 && e.children.length === 0 && e.textContent.trim().length > 2; }).map((e) => e.textContent.trim());
    // ① 首帧：只看"宽的 blob 预览图"（头像/旧缩略图都 <300px）
    const refAttached = [...document.querySelectorAll('img')].some((i) => i.src.startsWith('blob:') && i.naturalWidth >= 600);
    const vids = [...document.querySelectorAll('video')].filter((v) => (v.src || '').includes('vlabvod.com')).map((v) => { const r = v.getBoundingClientRect(); return { src: v.src, w: Math.round(r.width), inCard: !!v.closest('[class*=info-card]') }; }).filter((v) => v.w > 200 && !v.inCard);
    const btn = [...document.querySelectorAll('button')].filter((e) => e.className.includes('lv-btn-primary') && e.className.includes('circle')).pop();
    return { credits, tasks: [...new Set(tasks)], refAttached, vids, canSubmit: btn ? !btn.disabled : false };
  })()`,
});

/** ③ 画风闸门：抽帧采样四角，必须接近纯绿幕（左上角是水印区，跳过） */
function backgroundIsGreenscreen(mp4) {
  const tmp = ROOT + '临时\\qc.png';
  try {
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '1.0', '-i', mp4, '-frames:v', '1', tmp], { stdio: 'ignore' });
    const png = PNG.sync.read(readFileSync(tmp));
    const at = (x, y) => { const o = (y * png.width + x) * 4; return [png.data[o], png.data[o + 1], png.data[o + 2]]; };
    const pts = [[png.width - 20, 20], [20, png.height - 20], [png.width - 20, png.height - 20], [Math.round(png.width / 2), 15]];
    let green = 0;
    const samples = [];
    for (const [x, y] of pts) {
      const [r, g, b] = at(x, y);
      samples.push(`${r},${g},${b}`);
      if (g > 150 && g > r * 1.4 && g > b * 1.4) green++;
    }
    return { ok: green >= 3, samples };
  } catch (error) {
    return { ok: false, samples: ['抽帧失败: ' + error.message] };
  }
}

const hashOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);
const existingHashes = new Set(
  readdirSync(ROOT + '视频源').filter((f) => f.endsWith('.mp4')).map((f) => hashOf(ROOT + '视频源\\' + f)),
);

async function generateOne(name) {
  const outPath = ROOT + `视频源\\${name}.mp4`;

  await post({ action: 'goto', url: 'https://jimeng.jianying.com/ai-tool/generate/?type=video', settleMs: 9000 });
  let st = await readState();
  if (st.credits >= 0 && st.credits < 30) return { stop: true, reason: `额度不足（${st.credits}）` };
  const before = st.tasks;

  // ① 首帧闸门
  let attached = false;
  for (let a = 1; a <= 3 && !attached; a++) {
    await post({ action: 'dropFile', selector: 'div[class*=reference-upload]', path: ROOT + '立绘\\肆喵-全身立绘.png', settleMs: 7000 });
    const s = await readState();
    attached = s.refAttached;
    log(`  首帧校验 ${a}/3: ${attached ? '✓ 已挂上' : '✗ 未挂上'}`);
  }
  if (!attached) return { ok: false, reason: '首帧始终挂不上' };

  await post({ action: 'typeInto', selector: 'div.tiptap.ProseMirror', text: ' ', delayMs: 1 });
  await post({ action: 'press', key: 'Control+A' });
  await post({ action: 'press', key: 'Delete' });
  await post({ action: 'typeInto', selector: 'div.tiptap.ProseMirror', text: promptFor(name), delayMs: 1 });
  await post({ action: 'wait', ms: 2000 });

  st = await readState();
  if (!st.canSubmit) return { ok: false, reason: '生成按钮不可用' };
  await post({ action: 'eval', js: `(() => { const b = [...document.querySelectorAll('button')].filter((e) => e.className.includes('lv-btn-primary') && e.className.includes('circle')); b[b.length - 1].click(); return 'clicked'; })()` });
  log('  已提交');

  let newTask = null;
  for (let k = 1; k <= 70 && !newTask; k++) {
    await sleep(12000);
    const s = await readState();
    const fresh = s.tasks.filter((t) => !before.includes(t));
    if (fresh.length) newTask = fresh[fresh.length - 1];
    else if (k % 5 === 0) log(`    ${Math.round((k * 12) / 60)} 分钟：仍在生成`);
  }
  if (!newTask) return { ok: false, reason: '未出现新任务' };

  await post({
    action: 'eval',
    js: `(() => { const el = [...document.querySelectorAll('*')].find((e) => e.textContent.trim() === ${JSON.stringify('__N__')} && e.getBoundingClientRect().x < 260 && e.getBoundingClientRect().width > 0); if (el) (el.closest('a,li,[class*=item]') || el).click(); return !!el; })()`.replace('__N__', newTask),
  });

  const tried = new Set();
  for (let k = 1; k <= 45; k++) {
    await sleep(12000);
    const s = await readState();
    for (const v of s.vids) {
      if (tried.has(v.src)) continue;
      tried.add(v.src);
      const r = await post({ action: 'saveUrl', url: v.src, path: outPath });
      if (!r || !r.bytes) continue;
      const hash = hashOf(outPath);
      if (existingHashes.has(hash)) { log(`  ② 重复（哈希 ${hash}），换一个结果`); continue; }   // ② 重复闸门
      const qc = backgroundIsGreenscreen(outPath);
      if (!qc.ok) { log(`  ③ 画风不对（背景采样 ${qc.samples.join(' | ')}），丢弃`); unlinkSync(outPath); continue; }  // ③ 画风闸门
      existingHashes.add(hash);
      return { ok: true, bytes: r.bytes, hash };
    }
    if (k % 5 === 0) log(`    等待结果… ${Math.round((k * 12) / 60)} 分钟`);
  }
  return { ok: false, reason: '没有通过质检的结果' };
}

const names = LIST.顺序;
let stop = false;
for (let i = Number(process.argv[2] ?? 0); i < names.length && !stop; i++) {
  const name = names[i];
  if (existsSync(ROOT + `视频源\\${name}.mp4`)) { log(`跳过（已存在）: ${name}`); continue; }
  log(`—— 第 ${i + 1}/${names.length} 条：${name} ——`);
  for (let attempt = 1; attempt <= 3 && !stop; attempt++) {
    const r = await generateOne(name);
    if (r.stop) { stop = true; log(r.reason); break; }
    if (r.ok) { log(`  ✓ ${name}  ${(r.bytes / 1048576).toFixed(2)} MB  哈希 ${r.hash}`); break; }
    log(`  ✗ 第 ${attempt} 次失败：${r.reason}`);
    if (attempt === 3) log(`  ⚠ ${name} 放弃`);
  }
}
log('批量结束');
